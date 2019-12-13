/*
This file is part of the HBP Morphology Viewer and INCF Scalable Brain 
Atlas, jointly called Web Application hereunder. 

Web Application is free software: you can redistribute it and/or
modify it under the terms of the GNU General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Web Application is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the 
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Web Application.  
If not, see <http://www.gnu.org/licenses/>
*/

"use strict";

/*
 * Utilities
 */
 
const getGuid = () => {
  const S4 = () => { return (((1+Math.random())*0x10000)|0).toString(16).substring(1); }
  return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

const namedError = (err,name) => {
  err.name = name;
  return err;
}

const customDiv = (doc,msg,clickToHide,timeout) => {
  let div = doc.createElement('div');
  if (msg) div.innerHTML = msg;
  if (clickToHide) div.onclick = () => {
    doc.body.removeChild(div); // hide this dialog
    div = false;
  }
  if (timeout) {
    let opacity = 1.0;
    const fade = () => { 
      opacity -= 0.05; 
      if (opacity<0.1) document.body.removeChild(div)
      else if (div) {
        div.style.opacity = opacity;
        setTimeout(fade,20);
      }
    }
    setTimeout(fade,timeout);
  }
  document.body.appendChild(div);
  return div;    
}

const ungzipbase64 = async (obj,pakoInflate) => {
  let numAffected = 0;
  for (let k in obj) if (obj.hasOwnProperty(k)) {
    const v = obj[k];
    const tp = typeof(v);        
    if (tp === 'object' && v) {
      if (v['@type'] === 'Base64GzippedBytes') {
        const name = v['instanceOf'];
        if (name === 'String') {
          obj[k] = pakoInflate(atob(v['bytes']),{to:'string'});
        } else {
          const abuf = pakoInflate(atob(v['bytes'])).buffer;
          const idx = name.indexOf('Array');
          if (idx === name.length-5 && window[name]) {
            obj[k] = new window[name](abuf);
          } else {
            obj[k] = abuf;
          }
        }
        numAffected += 1;
      } else { 
        numAffected += ungzipbase64(v,pakoInflate);
      }
    }
  }
  return numAffected;
}

const base64gzip = (obj,pakoGzip) => {
  let numAffected = 0;
  for (let k in obj) if (obj.hasOwnProperty(k)) {
    const v = obj[k];
    if (!v) continue;
    const tp = typeof(v);
    let bytes;
    let instanceOf;
    if (tp === 'string' && (v.length>256 || v.indexOf("'")>-1)) {
      // encode long strings and strings that contain single quotes (so they don't need to be escaped)
      bytes = v,
      instanceOf = 'String';
    } else if (tp === 'object') {
      if (v instanceof ArrayBuffer) {
        bytes = v;
        instanceOf = 'ArrayBuffer';
      } else if (v.buffer instanceof ArrayBuffer) {
        if (v.constructor && v.constructor.name) {
          const name = String(v.constructor.name);
          const idx = name.indexOf('Array');
          if (idx === name.length-5) {
            try {
              const ok = v instanceof window[name];
              bytes = v.buffer; 
              instanceOf = name;
            } catch(err) {
              console.log(err);
            }
          }
        }
      }
    }
    if (bytes) {
      obj[k] = {
        "@type": "Base64GzippedBytes",
        instanceOf: instanceOf,
        bytes: btoa(pakoGzip(bytes,{level:6,to:'string'}))
      }
      numAffected += 1;
    } else if (tp === 'object') {
      numAffected += base64gzip(v);
    }
  }
  return numAffected;
}

const decodeRequest = async (command) => {
  const context = command['@context'] || {};
  if ('Base64GzippedBytes' in context) {
    const pako = await import('./pako.mod.js');
    const numAffected = ungzipbase64(command,pako.inflate);
    delete context['Base64GzippedBytes'];
  }
  return command;
}

/*
 * rpcInterface opens a new Web Application window,
 * and waits for the user to send commands to it.
 * When the window is closed or popup-blocked, it asks the user
 * permission to reopen it.
 * 
 * appAcronym and appName are used in the composition of error
 * messageserror handling.
 * 
 * eventHandler is a function called when messages are received from 
 * the Web Application that are not in response to a request.
 * 
 * channelName is the broadcast channel that the interface listens to.
 * This is only needed to communicate with certain Jupyter environments, 
 * in particular Google Colabs.
 * 
 */
function rpcInterface_class(appUrl,appName,eventHandler,channelName) {
  if (!appUrl) return;
  this.appWindowId = getGuid();
  this.appWindow = undefined;
  this.appWindowState = undefined;
  this.newTab=false;
  this.appWindowReadyPromise = undefined;
  this.confirmReopenPromise = undefined;
  this.confirmReopenDiv = undefined;
  this.partialResponses = {};
  this.appName = appName || 'Web Application';
  this.eventHandler = eventHandler;
  
  // ensure that appUrl is an absolute url
  const a = document.createElement("a");
  a.href = appUrl;
  this.appUrl = a.href;

  if (channelName) {
    this.listenerChannel = new BroadcastChannel(channelName);
    this.listenerChannel.onmessage = (msg) => {
      this.send(msg.data);
    };
  }

  // open Web Application window
  this._initAppWindow();
  
  // listen to incoming requests
  this._initAppListener();
}

rpcInterface_class.prototype = {
  protocolVersion: "1.0",
  modalDiv: function(msg) {
    const div = customDiv(window.document,msg);
    div.style += 'box-sizing: border-box; position: fixed; top: 25%; left: 50%; max-width: 96%; transform: translate(-50%, -50%); padding: 3em; border: 1em solid #888; border-radius: 3em; background: #00FF00; text-align: center; white-space: nowrap; z-index: 999';
    return div;
  },
  notificationDiv: function(msg) {
    const div = customDiv(window.document,msg,true,6000);
    div.style += 'box-sizing: border-box; position: fixed; top: 2%; right: 2%; max-width: 96%; padding: 1em; border: 0.5em solid #888; border-radius: 1em; background: #00FF00; text-align: center; z-index: 999';
    return div;
  },
  errorDiv: function(msg) {
    const div = customDiv(window.document,msg,true);
    div.style += 'box-sizing: border-box; position: fixed; top: 2%; right: 2%; max-width: 96%; padding: 1em; border: 0.5em solid #888; border-radius: 1em; color: #FFF; background: #F00; text-align: center; z-index: 999';
  },
  displayError: function(err) {
    this.errorDiv((err.name || 'Error')+' in '+this.appName+'<div style="color: #000; background: #f84; padding:0.5em; margin:0.5em; border: 0px solid black; border-radius: 0.5em; overflow: auto">'+(err.message || err)+'</div>(<i>click to hide</i>)');
  },
  _initAppListener: function() {
    // in case of an load/unload event, reset myWindowReadyPromise 
    const listener = (evt) => {
      const rpc = evt.data;
      if (rpc && rpc.method && rpc.id && rpc.id.substr(0,this.appWindowId.length) === this.appWindowId) {
        // any incoming request from the remote app should start with its appWindowId.
        const method_lc = rpc.method.toLowerCase();
        if (method_lc === 'window.event') {
          const type = rpc.params && rpc.params.type;
          if (type === 'load') {
            this.appWindowState = 'ready';
          } else if (type === 'unload') {
            if (this.appWindowState === 'ready') this.appWindowReadyPromise = undefined;
            this.appWindowState = 'closed';
          }
        } else {
          if (eventHandler) eventHandler(rpc.params)
          else console.log('Incoming request "'+method_lc+'" ignored.');
        }
      }
    }
    window.addEventListener('message', listener);
  },
  _initAppWindow: function() {
    if (this.newTab) this.appWindowId = getGuid();
    // open a new rpc window. It will return a message when ready
    this.appWindow = window.open(this.appUrl, this.appWindowId);
    this.appWindowReadyPromise = undefined;
    this.appWindowState = (this.appWindow ? 'loading' : 'closed');
  },
  _awaitAppWindowReady: function() {
    if (!this.appWindowReadyPromise) this.appWindowReadyPromise = new Promise( (resolve,reject) => {
      if (this.appWindowState === 'ready') {
        resolve();
      } else if (this.appWindowState === 'loading') {
        const listener = (evt) => {
          const rpc = evt.data;
          if (rpc && rpc.method) {
            const method_lc = rpc.method.toLowerCase();
            if (method_lc === 'window.event' && rpc.id === this.appWindowId) {
              const type = rpc.params && rpc.params.type;
              if (type === 'load') {
                window.removeEventListener('message', listener);
                this.appWindowState = 'ready';
                resolve();
              }
            }
          }
        }
        window.addEventListener('message', listener);        
      } else {
        reject(namedError(Error(this.appName+' window is closed.'),'ConnectionError'));
      }
    } );
    return this.appWindowReadyPromise;
  }, 
  _awaitConfirmReopen: function(msg) {
    if (this.confirmReopenPromise === undefined) this.confirmReopenPromise = new Promise( (resolve,reject) => {
      // show dialog if the window did not respond or the message was not received. 
      this.confirmReopenDiv = this.modalDiv(msg);
      const buttons = document.createElement('p');
      buttons.style = "padding-top: 0.5em";
      const btnOk = document.createElement('input');
      btnOk.type = 'button';
      btnOk.value = 'Re-open '+this.appName;
      btnOk.onclick = () => {
        document.body.removeChild(this.confirmReopenDiv);
        this.confirmReopenPromise = this.confirmReopenDiv = undefined;
        this._initAppWindow();
        resolve('reopen');
      }  
      const btnCancel = document.createElement('input');
      btnCancel.type = 'button';
      btnCancel.value = 'Cancel';
      btnCancel.onclick = () => {
        document.body.removeChild(this.confirmReopenDiv);
        this.confirmReopenPromise = this.confirmReopenDiv = undefined;
        reject(namedError(Error(this.appName+' not reopened.'),'ConfirmationError'));
      }  
      buttons.appendChild(btnOk)
      buttons.appendChild(document.createTextNode(' '))
      buttons.appendChild(btnCancel)
      this.confirmReopenDiv.appendChild(buttons);      
    });
    return this.confirmReopenPromise;
  },
  _awaitReceived: function(rpcId) {
    return new Promise( (resolve,reject) => {
      const listener = (evt) => {
        const response = evt.data;
        if (response && response.id && response.id === rpcId) {
          if ('result' in response) {
            const readyState = (response.rpc && response.rpc.readyState);
            if (readyState > 0) {
              if (this.confirmReopenDiv) {
                // no need to reopen if data has been received
                document.body.removeChild(this.confirmReopenDiv);
                this.confirmReopenPromise = this.confirmReopenDiv = undefined;
              }
              window.removeEventListener('message', listener);
              resolve('received');
            }
          } else if (response.error) {
            window.removeEventListener('message', listener);
            reject(namedError(Error(response.error.message || response.error),'RemoteError'));
          }
        }
      }
      window.addEventListener('message', listener);
    } );
  },
  _doTimeout: function(timeout) {
    return new Promise( (resolve,reject) => {
      setTimeout( () => reject(namedError(Error(this.appName+' did not respond for '+timeout/1000+' seconds.'),'TimeoutError')), timeout )
    } );
  },
  _truncateResponse: function(response) {
    const s = JSON.stringify(response);
    // Already truncated?
    if (response.rpc && 'partsRemaining' in response.rpc) return s;
    // Tuned to the max message size of Jupyter notebook send_input_reply.
    //const maxLength = 1023*1024; // use 1MB minus some header space
    const maxLength = 1020*1024; // use 1MB minus some header space
    const rpcId = response.id;
    if (s.length>maxLength) {
      const chunks = [];
      let i=0;
      while (i<s.length) {
        chunks.push(s.substr(i,maxLength));
        i += maxLength;
      }
      this.partialResponses[rpcId] = chunks;
      const chunk = this._nextResponse(rpcId);
      chunk.rpc.firstPart = true;
      return JSON.stringify(chunk);
    } else {
      return s
    }
  },
  _nextResponse: function(rpcId) {
    const chunks = this.partialResponses[rpcId];
    const s = chunks.shift();
    const complete = !chunks.length;
    const rpc = { partsRemaining: chunks.length };
    if (complete) delete this.partialResponses[rpcId];
    return {
      id: rpcId,
      rpc: rpc,
      result: s
    }
  },
  _fetchResponse: function(rpcId,callback,keepAlive) {
    const createListener = (resolve,reject) => {
      const listener = (evt) => {
        const response = evt.data;
        if (response && response.id && response.id === rpcId) {
          if ('result' in response) {
            const readyState = (response.rpc && response.rpc.readyState);
            if (readyState === 4) {
              if (!keepAlive) window.removeEventListener('message', listener);
              if (response.rpc.readyMessage) {
                this.notificationDiv('Message from '+this.appName+'<div style="background: #bfb; padding:0.5em; margin:0.5em; border: 0px solid black; border-radius: 0.5em; overflow: auto">'+response.rpc.readyMessage+'</div>(<i>click to hide</i>)');
              }
              resolve(response);
            }
          } else if (response.error) {
            window.removeEventListener('message', listener);
            const err = namedError(Error(response.error.message || response.error),'RemoteError');
            this.displayError( err );
            if (reject) reject(err); else throw(err);
          }
        }
      }
      window.addEventListener('message',listener);
    }
    if (callback) createListener(callback);
    return new Promise( (resolve,reject) => {    
      createListener(resolve,reject);
    } );
  },
  send: async function(command,callback,keepAlive) {
    // FIXME: the callback / keepAlive functionality needs to be tested.
    command = await decodeRequest(command);
    // Finalize parameters
    const method_lc = String(command.method).toLowerCase();
    console.log('Sending "'+method_lc+'"-command.');
    const params = command.params;
    if (method_lc === 'rpc.nextpart') {
      return this._nextResponse(params.rpcId);
    }
    // Ensure that window is ready
    let rpcId = command.id || getGuid();
    const windowReady = this._awaitAppWindowReady();
    try {
      await Promise.race([windowReady, this._doTimeout(10000)]);
    } catch(err) {
      // Reject because window is not ready: prompt to reopen, then resend
      if (err.name == 'TimeoutError') this.newTab = true; // next time, open in a new tab
      try {
        const status = await this._awaitConfirmReopen(err.message);
        if (status === 'reopen') {
          // Resolve when reopen ok: resend command
          console.log('Resend command (window not ready)');
          return this.send(command);
        }
      } catch(err) {
        // Reject when reopen cancelled
        console.log('Reopen cancelled (window not ready)');
        return { id:rpcId, error:{ message:err.message, data: err } }
      }
    }
    // Ready to send command
    this.appWindow.postMessage(
      {
        jsonrpc: "2.0",
        id: rpcId,
        method: method_lc,
        params: params
      },
      this.appUrl
    );
    // Ensure that command is received
    const received = this._awaitReceived(rpcId);
    try {
      await Promise.race([received, this._doTimeout(500)]);
    } catch(err) {
      // Reject when message not received: prompt to reopen window, then resend
      console.log('Timeout on receive');
      try {
        //const status = await Promise.race([received,_awaitConfirmReopen(err.message)]);
        const status = this._awaitConfirmReopen(err.message);
        if (status === 'reopen') {
          // Resolve when reopen ok: resend command
          console.log('Resend command (not received)');
          return this.send(command);
        }
      } catch(err) {
        // Reject when reopen cancelled
        console.log('Reopen cancelled (not received)');
        return { id:rpcId, error:{ message:err.message, data: err } }
      }
    }
    // Wait for response
    console.log('Waiting for response'+(keepAlive ? 's (keep alive)' : ''));
    return this._fetchResponse(rpcId,callback,keepAlive)
    .then( (response) => {
      console.log('Response ready');  
      //if (callback) callback(response); ALREADY TAKEN CARE OF WITH 2 listeners
      return response;
    } )
    .catch( (err) => {
      console.log('Response error');
      this.displayError( err );
      throw(err);
    } )
  },
  encodeResponse: async function(response) {
    const result = response.result;
    if (result instanceof Object) {
      const pako = await import('./pako.mod.js');
      const numAffected = base64gzip(result,pako.gzip);
      if (numAffected) {
        const context = response['@context'] || {};
        context['Base64GzippedBytes'] = '';
        response['@context']  = context;
      }
    }
    return response;
  },
  packResponse: async function(response) {
    return this._truncateResponse(await this.encodeResponse(response));
  },
}

export { rpcInterface_class };