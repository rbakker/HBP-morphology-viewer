# FIXME: check the rpc-interface.js version and warn if incompatible

# support python 2.7+ and 3
from __future__ import unicode_literals
from IPython.display import display, Javascript, clear_output
from json import dumps as json_encode, loads as json_decode
# the base64 library produces clean output without newlines
from base64 import b64encode,b64decode
import gzip
import ipywidgets as widgets
try:
    from urlparse import urljoin  # Python2
except ImportError:
    from urllib.parse import urljoin
import sys,traceback
import numpy
import asyncio, uuid

def JS(s): 
  out = widgets.Output()
  with out:
    display(Javascript(s),transient=True)
  out.clear_output()

class RpcInterface:
  def __init__(self,instanceName,baseUrl='https://neuroinformatics.nl/HBP/morphology-viewer',appUrl='./',scriptUrl='./js/rpc-interface.js'):
    self.instanceName = instanceName
    self.partialResponses = {}
    self.jsInterface = 'window.global_rpcInterfaces["{}"]'.format(instanceName)
    if baseUrl[:-1] != '/': baseUrl = baseUrl + '/'
    appUrl = urljoin(baseUrl,appUrl)
    scriptUrl = urljoin(baseUrl,scriptUrl)
    
    # In Javascript, load scriptUrl and create a new Interface object
    JS("""
if (!window.global_rpcScriptReady) {{
  window.global_rpcScriptReady = new Promise( (resolve) => {{
    const script = document.createElement('script');
    script.src = '{}';
    script.onload = () => {{
      resolve();
    }}
    document.head.appendChild(script)
  }} );
}}
window.global_rpcScriptReady
.then( () => {{
  if (!window.global_rpcInterfaces) window.global_rpcInterfaces = {{}}; 
  {} = new moviInterface_class('{}');
  window.global_moviResponseHandler = (packedResponse,callback) => {{  
    if (callback) {{
      const kernel = IPython.notebook.kernel;
      const pyCommand = 'response = {}.unpackResponse(r\\''+packedResponse+'\\')\\nif "result" in response:\\n  '+callback+'(response)\\nelif "method" in response:\\n  {}.send(response,r\\''+callback+'\\')';
      kernel.execute(pyCommand);
    }}
  }}
}} );
    """.format(scriptUrl,self.jsInterface,appUrl,instanceName,instanceName))
  
  @staticmethod
  def encodeRequest(command):
    def base64gzip(obj):
      numAffected = 0
      keys = obj.keys() if isinstance(obj, dict) else range(len(obj))
      for k in keys:
        v = obj[k]
        tp = type(v);
        data = None;
        instanceOf = None
        if tp is str and (len(v)>256 or v.find("'")>-1):
          data = v.encode('utf-8')
          instanceOf = 'String'
        elif tp is bytes:
          data = v;
          instanceOf = 'ArrayBuffer';
        elif tp is numpy.array and v.dtype.kind in ['i','u','f']:
          # FIXME: support for typed arrays is incomplete
          data = v.tobytes()
          instanceOf = '{}{}Array'.format({'i':'Int','u':'Uint','f':'Float'}[v.dtype.kind],8*v.dtype.itemsize)
        if (data):
          obj[k] = {
            "@type": "Base64GzippedBytes",
            "instanceOf": instanceOf,
            "bytes": b64encode(gzip.compress(data)).decode('utf-8')
          }
          numAffected += 1;
        elif tp in (dict,list,tuple):
          numAffected += base64gzip(v)
      return numAffected;
  
    # encode binary contents inside command
    numAffected = base64gzip(command)
    if numAffected:
      context = command['@context'] if '@context' in command else {}
      context['Base64GzippedBytes'] = ''
      command['@context'] = context
    return command
  
  @staticmethod
  def decodeResponse(response):
    def ungzipbase64(obj):
      keys = obj.keys() if isinstance(obj, dict) else range(len(obj))
      for k in keys:
        v = obj[k]
        tp = type(v);        
        if tp is dict and '@type' in v and v['@type'] == 'Base64GzippedBytes':
          data = gzip.decompress(b64decode(v['bytes']))
          if v['instanceOf'] == 'String':
            data = data.decode("utf-8")
          obj[k] = data
        elif tp in (dict,list,tuple):
          ungzipbase64(v);
      
    try:
      context = response['@context'] if '@context' in response else {}
      if 'Base64GzippedBytes' in context: 
        ungzipbase64(response)
        context.pop('Base64GzippedBytes')
    except:
      exc_type, exc_value, exc_traceback = sys.exc_info() 
      tb = traceback.format_exception(exc_type, exc_value, exc_traceback)
      msg = tb.pop()
      try: id = result['id']
      except: id = 0
      return {
        "id":id, 
        "error":{"message":"Error in decodeResponse: {}".format(msg)},
        "data":{"trace":tb}
      }
    return response
    
  def unpackResponse(self,response):
    response = json_decode(response);
    rpc = response['rpc'] if 'rpc' in response else {};
    if 'partsRemaining' in rpc:
      rpcId = response['id']
      if 'firstPart' in rpc:
        self.partialResponses[rpcId] = [ response['result'] ]
      else:
        self.partialResponses[rpcId].append( response['result'] )
      if rpc['partsRemaining'] > 0:
        return { "method": "rpc.nextPart", "params":{ "rpcId": rpcId } }
      else:
        # Complete!
        parts = self.partialResponses.pop(rpcId)
        response = json_decode("".join(parts))
    return self.decodeResponse(response)

  def awaitUnpackResponse(self,response):
    def validateInput(response):
      try:
        response = json_decode(response)
        assert type(response) is dict
      except:
        raise RuntimeError("Request cancelled or invalid response.")
      return response
      
    response = validateInput(response);
    rpcId = response['id']
    rpc = response['rpc'] if 'rpc' in response else {};
    if 'firstPart' in rpc:
      command = { "method": "rpc.nextPart", "params":{ "rpcId": rpcId } }
      parts = [response['result']]
      while rpc['partsRemaining']>0:
        self.send(command,None,True)
        partialResponse = validateInput( input('Got partial response, awaiting more... (Press <enter> to cancel)') )
        parts.append( partialResponse['result'] )
        rpc = partialResponse['rpc']
      response = json_decode("".join(parts))
    return self.decodeResponse(response)


  def send(self,command,callback=None,awaitInput=False):
    """Sends a command to the Morphology Viewer.
    Parameters:
    command: Command in json-rpc2 format, with a method, params and id.
    callback: Name of the python function that processes the response, accessible in the caller's context. Note: the json module must be available on the system.
    """
    if not 'id' in command: command['id'] = uuid.uuid4().hex
    command = self.encodeRequest(command)
    if awaitInput:
      JS("""window.global_rpcScriptReady.then( () => {}.send({}) ).then( (response) => {{ response = {}.packResponse(response); const kernel = IPython.notebook.kernel; kernel.send_input_reply(response) }} )""".format(self.jsInterface,json_encode(command),self.jsInterface))
    else:
      if callback and hasattr(callback,'__name__'): callback = callback.__name__
      JS("""window.global_rpcScriptReady.then( () => {}.send({}) ).then( (response) => {{ response = {}.packResponse(response); global_moviResponseHandler(response,{}) }} )""".format(self.jsInterface,json_encode(command),self.jsInterface,json_encode(callback)))
    return command['id']
    
  def awaitResponse(self,command):
    try:
      self.send(command,None,True)
      response = input('Awaiting response... (Press <enter> to cancel)')
      response = self.awaitUnpackResponse(response)
    except:
      exc_type, exc_value, exc_traceback = sys.exc_info() 
      tb = traceback.format_exception(exc_type, exc_value, exc_traceback)
      msg = tb.pop()
      try: id = result['id']
      except: id = 0
      return {
        "id":id, 
        "error":{"message":"Error in decodeResponse: {}".format(msg),"data":{"trace":tb}}
      }
    return response;


class MoviInterface:
  
