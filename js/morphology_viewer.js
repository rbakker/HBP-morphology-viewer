                                                                                                                                                   /*
This file is part of the HBP morphology viewer.

HBP morphology viewer is free software: you can redistribute it and/or
modify it under the terms of the GNU General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

HBP morphology viewer is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the 
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with HBP morphology viewer.  
If not, see <http://www.gnu.org/licenses/>
*/

"use strict";
var global_tree = {}

function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) == variable) {
      return decodeURIComponent(pair[1]);
    }
  }
}

function escapeHtml(text) {
  return String(text)
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;")
    .replace('"', "&quot;")
    .replace('\'', "&#039;");
}

function toggleHtml(status) {
  if (status=='open') return '[&#8211;]';
  if (status=='closed') return '[+]';
  return '[&#160;]';
}

function doToggle(elem) {
  var status = 'disabled';
  var contentElem = elem.parentNode.children[2];
  if (contentElem) {
    status = elem.className.substr(7);
    status = (status=='open' ? 'closed' : 'open');
    elem.className = 'toggle-'+status;
    contentElem.className = 'content-'+status;
  }
  elem.innerHTML = toggleHtml(status);
}

function toggleShape(name) {
  var node = global_tree[name]
  if (node) node.toggleVisibility()
}

function genTable(th,data,className) {
  var tr = th ? [th] : [];
  if (data) {
    var isArray = data instanceof Array;
    if (data instanceof Object) {
      for (var k in data) {
        var v = data[k]
        if (typeof(v) == 'object') v = '<pre>'+escapeHtml(JSON.stringify(v,undefined,2))+'</pre>';
        else v = escapeHtml(v);
        if (isArray) tr.push('<td colspan="2">'+v+'</td>');
        else tr.push('<td>'+k+'</td><td>'+v+'</td>');
      }
    }
  }
  return '<table class="'+className+'"><tr>'+tr.join('</tr><tr>')+'</tr></table>';
}

function treeHtml(tree,tagName,level) {
  global_tree[tree.name] = tree;
  if (!level) level = 0;
  if (!tagName) tagName = 'h3';
  var status = 'disabled';
  if (level>0) status = 'closed';
  var toggleMe = '<div class="toggle-'+status+'" onclick="doToggle(this)">'+toggleHtml(status)+'&#160;</div>';
  var shapeMe = ''
  if (tree.parent) {
    var checked = tree.visible===false ? '' : ' checked'
    shapeMe = '<input type="checkbox"'+checked+' onchange="toggleShape(\''+escapeHtml(tree.name)+'\')"/>';
  }
  var startContent = '<div class="content-'+status+'">';
  var endContent = '</div>';
  var name = tree.name ? tree.name : (tree.info.type ? tree.info.type : '');
  var ans = toggleMe+' '+'<'+tagName+'>'+shapeMe+' '+name+'</'+tagName+'>'+startContent;
  ans += '<div class="result">';
  ans += '<b>'+JSON.stringify(tree['info'])+'</b>';
  ans += '<div>';
  var R = tree['_segm'];
  ans += genTable(undefined,R,'result');
  ans += '</div>';
  ans += '</div>';

  var branches = tree.children;
  if (branches) {
    var li = [];
    for (var k in branches) {
      li.push(treeHtml(branches[k],'h3',level+1));
    }
    ans += '<ol style="display:block"><li>'+li.join('</li><li>')+'</li></ol>';
  }
  ans += endContent;
  return ans;
}

function handleLineClick(lineElem) {
  alert(lineElem.id);
}

function treeToShapes(tree,color) {
  var x3d = []
  var type = tree.type
  var info = tree.info
  if (type == 'marker') return ''
  if (color == undefined) color = '0 0 0'
  if (type == 'axon') color = '0 0 1'
  if (type == 'dendrite') color = '1 0 0'
  if (type == 'apical') color = '0.5 0 0'
  var _segm = tree._segm
  if (_segm.length>1) {
    var render = (tree.visible !== false)
    x3d.push('<Shape id="'+tree.name+'" onclick="handleLineClick(this)" render="'+render+'">')
    x3d.push('<Appearance><Material emissiveColor="'+color+'"></Material>')
    x3d.push('<LineProperties linetype="1" linewidthScaleFactor="4" applied="true" containerField="lineProperties"></LineProperties></Appearance>')
    var points = []
    if (tree.parent) {
      var p_segm = tree.parent._segm
      var len = p_segm.length
      if (len) {
        points.push([p_segm[len-4],p_segm[len-3],p_segm[len-2]].join(','))
      }
    }
    for (var i=0; i<_segm.length; i+=4) {
      points.push([_segm[i+0],_segm[i+1],_segm[i+2]].join(','))
    }
    x3d.push('<LineSet vertexCount="'+(points.length)+'" containerField="geometry">')
    x3d.push('<Coordinate point="'+points.join(' ')+'"/>')
    x3d.push('</LineSet>')
    x3d.push('</Shape>')
  }
  var branches = tree.children;
  for (var i=0; i<branches.length; i++) {
    x3d.push(treeToShapes(branches[i],color))
  }
  return x3d.join('\n')
}

function sqr(x) { return x*x; }

function node_class(info,segm,parent) {
  this.name = info.name
  this.type = info.type
  delete info.name
  delete info.type
  this.info = info
  this.children = []
  if (parent) {
    if (this.type == 'contour') {
      if (!parent.contours) parent.contours = new node_class({ name:'contours', type:'contours' },[],parent)
      parent = parent.contours
      parent.visible = false
    } else if (this.type == 'marker') {
      if (!parent.markers) parent.markers = new node_class({ name:'markers', type:'markers' },[],parent)
      parent = parent.markers
    }
    parent.children.push(this)
    this.visible = parent.visible
    if (!this.name) this.name = parent.name+'.'+parent.children.length
  } else {
    this.nameCount = {}
    this.typeCount = {}
  }
  this.parent = parent
  if (this.type == 'contour') {
    if (info.closed) {
      segm.push(segm[0])
    }
  }
  this._segm = this.serializeSegment(segm)
}

node_class.prototype.serializeSegment = function(segm) {
  var i,j,segm_i
  var _segm = new Float32Array(4*segm.length)
  for (var i=0; i<segm.length; i++) {
    var segm_i = segm[i]
    for (var j=0; j<4; j++) _segm[i*4+j] = segm_i[j]
  }
  return _segm;
}

node_class.prototype.prepareStats = function() {
  var wl = 0;
  var mn,mx,ctr,x,y,z,xPrev,yPrev,zPrev;
  var _segm = this._segm;
  if (_segm.length>0) {
    mn = [_segm[0],_segm[1],_segm[2]]; // copy by value
    mx = [_segm[0],_segm[1],_segm[2]];
    ctr = [_segm[0],_segm[1],_segm[2]];
    xPrev = _segm[0];
    yPrev = _segm[1];
    zPrev = _segm[2];
  } else {
    xPrev = yPrev = zPrev = 0;
  }
  for (var i=1; i<this._segm.length; i+=4) {
    x = _segm[4*i+0];
    y = _segm[4*i+1];
    z = _segm[4*i+2];
    wl += Math.sqrt(sqr(x-xPrev)+sqr(y-yPrev)+sqr(z-zPrev));
    ctr[0] += x;
    ctr[1] += y;
    ctr[2] += z;
    if (x<mn[0]) mn[0] = x;
    if (y<mn[1]) mn[1] = y;
    if (z<mn[2]) mn[2] = z;
    if (x>mx[0]) mx[0] = x;
    if (y>mx[1]) mx[1] = y;
    if (z>mx[2]) mx[2] = z;
    xPrev = x;
    yPrev = y;
    zPrev = z;
  }
  if (mn !== undefined) this.limits = [mn,mx];
  this.wireLength = wl;
  this.centerOfMass = ctr;
}

node_class.prototype.contourName = function(v) {
  var nc = this.parent ? this.parent.nameCount : this.nameCount;
  if (nc[v] !== undefined) {
    nc[v] += 1;
    return v+' ('+nc[v]+')';
  } else {
    nc[v] = 0;
    return v;
  }
}

node_class.prototype.branchName = function(v) {
  var tc = this.parent ? this.parent.typeCount : this.typeCount;
  if (tc[v] !== undefined) tc[v] += 1;
  else tc[v] = 1;
  return v+' #'+tc[v];
}

node_class.prototype.addBranchFromRaw = function(raw) {
  var b,i,mc,tc,tov0,v,v0;
  var iStart = 0;
  var info = {};
  v = raw[0];
  if (typeof v == 'string') {
    if (v.charAt(0) == '@') {
      info.type = 'marker';
      info.shape = v.substr(1);
      mc = this.markerCount;
      mc = (mc === undefined ? 1 : mc+1);
      info.name = info.shape+'@'+mc;
      this.markerCount = mc;
    } else {
      info.type = 'contour';
      info.name = this.contourName(v);
    }
    iStart = 1;
  }
  var segm = [];
  var branches = [];
  for (i=iStart; i<raw.length; i++) {
    v = raw[i];
    if (typeof v == 'string') {
      info.type = 'marker';
      info.text = v;
      mc = this.markerCount;
      mc = (mc === undefined ? 1 : mc+1);
      info.name = this.name+'@'+mc;
      this.markerCount = mc;
    } else {
      v0 = v[0];
      tov0 = typeof v0;
      if (tov0 == 'string') {
        if (v.length==1) {
          if (info.type === undefined) {
            info.type = v0.toLowerCase();
            info.name = this.branchName(v0)
          } else {
            info[v0.toLowerCase()] = true;
          }
        } else if (v.length==2) {
          info[v0] = v[1];
        }
      } else if (tov0 == 'number') {
        if (v.length==4) segm.push(new Float32Array(v));
        else RuntimeError('ASC parser: expecting array length to be 4.')
      } else {
        branches.push(i);
      }
    }
  }
  var branch = new node_class(info,segm,this);
  for (b=0; b<branches.length; b++) {
    i = branches[b];
    branch.addBranchFromRaw(raw[i])
  }
}

node_class.prototype.V3DAT_index2type = {
  0x0001: ['string',6,false],
  0x0101: ['sample',6,false],
  0x0102: ['?',6,false],
  0x0103: ['sample list',6,false],
  0x0104: ['property',6,false],
  0x0105: ['property list',6,false],
  0x0201: ['contour',6,false],
  0x0202: ['tree',6,false],
  0x0203: ['subtree',6,false],
  0x0204: ['markerset',6,false],
  0x0205: ['markerset list',6,false],
  0x0206: ['spine',6,false],
  0x0207: ['spine list',6,false],
  0x0208: ['text',6,false],
  0x0209: ['subtree',6,false],
  0x0401: ['thumbnail',6,false],
  0x0402: ['description',6,false],
  0x0403: ['image data',6,false],
};

node_class.prototype.V3DAT_parseSample = function(bytes,pos) {
  var x = bytes.getFloat32(pos+6,true);
  var y = bytes.getFloat32(pos+10,true);
  var z = bytes.getFloat32(pos+14,true);
  var d = bytes.getFloat32(pos+18,true);
  var c = bytes.getUint16(pos+22,true);
  return [x,y,z,d,c];
}

node_class.prototype.V3DAT_parseSegment = function(bytes,pos) {
  var sz = bytes.getUint32(pos+2,true);
  var segm = [];
  var jump = 8;
  while (jump<sz) {
    var tp = bytes.getUint16(pos+jump,true);
    if (tp != 0x0101) break;
    segm.push(this.V3DAT_parseSample(bytes,pos+jump));
    jump += bytes.getUint32(pos+jump+2,true);
  }
  return segm;
}

node_class.prototype.V3DAT_parseString = function(bytes,pos) {
  var sz = bytes.getUint32(pos+2,true);
  var ans = '';
  for (var i=6; i<sz; i++) ans += String.fromCharCode(bytes.getUint8(pos+i,true));
  return ans;
}

node_class.prototype.V3DAT_parsePropertyList = function(bytes,pos) {
  var sz = bytes.getUint32(pos+2,true);
  var len = bytes.getUint16(pos+6,true);
  var jump = 8;
  var kv = {}
  while (jump<sz) {
    var prop_tp = bytes.getUint16(pos+jump,true);
    if (prop_tp !== 0x0104) {
      RuntimeError('Expecting property in property list.');
      break;
    }
    var prop_sz = bytes.getUint16(pos+jump+2,true);
    var key = this.V3DAT_parseString(bytes,pos+jump+6);
    var str_sz = bytes.getUint32(pos+jump+6+2,true);
    var val = true;
    var hasValue = bytes.getUint16(pos+jump+6+str_sz,true);
    if (hasValue) {
      var isString = bytes.getUint16(pos+jump+6+str_sz+2,true);
      if (isString) {
        val = this.V3DAT_parseString(bytes,pos+jump+6+str_sz+4);
      } else {
        val = bytes.getFloat32(pos+jump+6+str_sz+4,true);
      }
    }
    kv[key] = val;
    jump += prop_sz;
  }
  return kv;
}
  
node_class.prototype.V3DAT_parseContour = function(bytes,pos) {
  var sz = bytes.getUint32(pos+2,true);
  var jump = 6;
  var v = this.V3DAT_parseString(bytes,pos+jump);
  var info = { type: 'contour', name: this.contourName(v) };
  jump += bytes.getUint32(pos+jump+2,true); // string
  jump += 8; // ? Closed ?
  if (bytes.getUint16(pos+jump,true) == 0x0105) {
    var kv = this.V3DAT_parsePropertyList(bytes,pos+jump)
    for (var k in kv) info[k] = kv[k];
    jump += bytes.getUint32(pos+jump+2,true); // property list
  }
  if (bytes.getUint16(pos+jump,true) == 0x0103) {
    var segm = this.V3DAT_parseSegment(bytes,pos+jump);
    jump += bytes.getUint32(pos+jump+2,true); // property list
  }    
  var branch = new node_class(info,segm,this);
  return sz;
}

node_class.prototype.V3DAT_parseBlock = function(bytes,pos) {
  var tp = bytes.getUint16(pos,true);
  var sz = bytes.getUint32(pos+2,true);
  if (pos+sz > bytes.byteLength) {
    RuntimeError('Data block points past end of file.')
    return
  }
  var spec = this.V3DAT_index2type[tp];
  if (!spec) {
    RuntimeError('Unknown data type index "'+tp+'" in Neurolucida DAT file.')
    return sz;
  }
  var type = spec[0];
  var skip = spec[1];
  var hasBlocks = spec[2];
  var info = { 'type':type }
  info.tp = tp;
  info.sz = sz;
  if (type.substr(-4) == 'list') {
    var len = bytes.getUint16(pos+6,true);
    if (len === 0) return info.sz;
    info.len = len;    
  }
  // now parse subBlocks
  var branch;
  var segm = [];
  if (type == 'markerset') {
    sz = 6;
    info.marker = this.V3DAT_parseString(bytes,pos+sz)
    sz += bytes.getUint32(pos+sz+2,true); // string size
    sz += 4; // opacity?
    var kv = this.V3DAT_parsePropertyList(bytes,pos+sz)
    for (var k in kv) info[k] = kv[k];
    sz += bytes.getUint32(pos+sz+2,true); // property list
    sz += bytes.getUint32(pos+sz+2,true); // sample list
    //info.ignored = true;
    //branch = new node_class(info,[],this);
    if (!this.info.ignoredMarkers) this.info.ignoredMarkers = 1;
    else this.info.ignoredMarkers += 1;
  } else if (type == 'tree' || type == 'subtree') {
    var jump = 6
    if (type == 'tree') {
      var typeCode = bytes.getUint16(pos+jump,true)
      if (typeCode == 0) info.type = 'axon'
      else if (typeCode == 1) info.type = 'dendrite'
      else if (typeCode == 2) info.type = 'apical'
      else info.type = 'tree'
      info.name = this.branchName(info.type)
      //console.log([bytes.getUint8(pos+jump,true),bytes.getUint8(pos+jump+1,true),bytes.getUint8(pos+jump+2,true),bytes.getUint8(pos+jump+3,true),bytes.getUint8(pos+jump+4,true),bytes.getUint8(pos+jump+5,true),bytes.getUint8(pos+jump+6,true),bytes.getUint8(pos+jump+7,true)]);
      jump += 8; // Axon type, RGB
      if (bytes.getUint16(pos+jump,true) == 0x0105) {
        var kv = this.V3DAT_parsePropertyList(bytes,pos+jump)
        for (var k in kv) info[k] = kv[k];
        jump += bytes.getUint32(pos+jump+2,true); // property list
      }    
      if (bytes.getUint16(pos+jump,true) == 0x0101) {
        segm.push(this.V3DAT_parseSample(bytes,pos+jump))
        jump += bytes.getUint32(pos+jump+2,true); // sample
      }
    } else {
      //console.log(this.name+' '+[bytes.getUint8(pos+jump,true),bytes.getUint8(pos+jump+1,true),bytes.getUint8(pos+jump+2,true),bytes.getUint8(pos+jump+3,true)]);
      jump += 4; // ???, number of branches
      if (bytes.getUint16(pos+jump,true) == 0x0103) {
        segm = this.V3DAT_parseSegment(bytes,pos+jump);
        jump += bytes.getUint32(pos+jump+2,true);
      }
    }
    branch = new node_class(info,segm,this);
    while (jump<sz) {
      var tp = bytes.getUint16(pos+jump,true);
      if (tp !== 0x0203 && tp !== 0x0204 && tp !== 0x0205 && tp !== 0x0207) {
        RuntimeError('Expecting subtree in '+type+', but got "'+this.V3DAT_index2type[tp][0]+'".');
        break;
      }
      jump += branch.V3DAT_parseBlock(bytes,pos+jump);
    }
    if (jump != sz) console.log(this.name+' sz '+sz+' jump '+jump)
  } else {
    info.ignored = true
    info.name = info.type
    branch = new node_class(info,[],this)
  }
  return sz;
}

// In the XML case, info is already filled with attributes.
node_class.prototype.addBranchFromXml = function(info,xmlElem) {
  var segm = [];
  var childNodes = xmlElem.childNodes;
  var i;
  for (i=0; i<childNodes.length; i++) {
    var ch = childNodes[i];
    if (ch.tagName == 'branch') break;
    if (ch.tagName == 'point') {
      segm.push([ ch.getAttribute('x'),ch.getAttribute('y'),ch.getAttribute('z'),ch.getAttribute('d') ]);
    } 
  }
  var branch = new node_class(info,segm,this);
  for (i=i; i<childNodes.length; i++) {
    var ch = childNodes[i];
    if (ch.tagName == 'branch') {
      branch.addBranchFromXml({},ch);
    }
  }
}

node_class.prototype.getLimits = function() {
  if (this.type == 'contours') return
  this.prepareStats();
  var limits,mn,mx,mn_i,mx_i;
  if (this.limits) {
    mn = new Float32Array(this.limits[0]); // copy by value
    mx = new Float32Array(this.limits[1]);
  }
  if (this.children.length) {
    var ch = this.children[0]
    for (var i=0; i<this.children.length; i++) {
      limits = this.children[i].getLimits();
      if (limits) {
        if (mn === undefined) {
          mn = new Float32Array(limits[0]); // copy by value
          mx = new Float32Array(limits[1]);
        } else {
          mn_i = limits[0];
          mx_i = limits[1];
          if (mn[0]>mn_i[0]) mn[0] = mn_i[0];
          if (mn[1]>mn_i[1]) mn[1] = mn_i[1];
          if (mn[2]>mn_i[2]) mn[2] = mn_i[2];
          if (mx[0]<mx_i[0]) mx[0] = mx_i[0];
          if (mx[1]<mx_i[1]) mx[1] = mx_i[1];
          if (mx[2]<mx_i[2]) mx[2] = mx_i[2];
        }
      }
    }
  }
  if (mn !== undefined) {
    return [mn,mx];
  }
}

node_class.prototype.toggleVisibility = function(makeVisible) {
  if (this.type == 'marker') return
  if (makeVisible == undefined) {
    if (this.visible == undefined) this.visible = true;
    makeVisible = !this.visible
  }
  if (makeVisible != this.visible) {
    var elem = document.getElementById(this.name)
    if (elem) elem.setFieldValue('render',makeVisible)
    this.visible = makeVisible;
  }
  for (var i=0; i<this.children.length; i++) {
    this.children[i].toggleVisibility(makeVisible)
  }
}

function resultToJSON(result,doParse) {
  // remove single line comments
  result = result.replace(/\s*;.*?$/mg,'');
  // replace | forks
  result = result.replace(/\)(\s*)\|(\s*)\(/g,')$1][$2(');
  result = result.replace(/\)(\s*)(["\w]+)(\s*)\|(\s*)\(/g,')$1["leaf","$2"]$3][$4(');
  result = result.replace(/\)(\s*)(["\w]+)(\s*)\)/g,')$1["leaf","$2"]$3)');
  // number quadruplets
  result = result.replace(/\(\s*([-.\d]+)\s*([-.\d]+)\s*([-.\d]+)\s*([-.\d]+)\s*\)/mg,'[$1,$2,$3,$4],');
  // contour names and markers
  result = result.replace(/\("([^"]*)"/g,'["$1",');
  result = result.replace(/\(([\w]+)(\s*)\(/g,'["@$1",$2(');
  // attributes
  result = result.replace(/\(\s*(\w[^\s]*)\s*\)/mg,'["$1"],');
  result = result.replace(/\(\s*(\w[^\s]*)\s*"([^\s].*)"\)/mg,function($0,$1,$2) { $2 = $2.replace(/"/g,'\\"'); return '["'+$1+'","'+$2+'"],' });
  result = result.replace(/\(\s*(\w[^\s]*)\s*([^\s].*)\)/mg,function($0,$1,$2) { $2 = $2.replace(/"/g,'\\"'); return '["'+$1+'","'+$2+'"],' });
  // replace round by square brackets
  result = result.replace(/$(\s*)\(/mg,'$1[');
  result = result.replace(/\)(\s*)^/mg,']$1');
  // remove excess commas
  result = result.replace(/\],(\s*)\]/g,']$1]');
  // add missing commas
  result = result.replace(/\](\s*)\[/g,'],$1[');
  
  if (doParse) {
    result = JSON.parse('['+result+']');
    if (!result) {
      RuntimeError('Could not convert the Neurolucida ASC file to valid JSON.')
    }
  }
  
  return result;
}

/*
function resultToRaw(result) {
  // remove single line comments
  result = result.replace(/\s*;.*?$/mg,'');

  // substitute expressions between double quotes
  var subst = [];
  result = result.replace(/(".*")/g,function($0,$1) {
    subst.push($1);
    return ' #'+(subst.length-1)+' ';
  })

  // recursively substitute expressions between parentheses
  var re = /\(\s*([^\(]*?)\s*\)/g;
  while (re.test(result)) {
    result = result.replace(re,function($0,$1) {
      var tokens = $1.split(/\s+/);
      for (var i=0; i<tokens.length; i++) {
        var v = tokens[i];
        if (v.charAt(0)=='#') {
          key = Number(v.substr(1));
          tokens[i] = subst[key];
        } else {
          v = new Number(v);
          if (!isNaN(v)) tokens[i] = v;
        }
      }
      subst.push(tokens);
      return ' #'+(subst.length-1)+' ';
    });
  }
  
  // remaining tokens link to end result
  raw = result.replace(/^\s+/,'').replace(/\s+$/,'').split(/\s+/);
  for (i=0; i<raw.length; i++) {
    var v = raw[i];
    if (v.charAt(0)=='#') {
      key = Number(v.substr(1));
      raw[i] = subst[key];
    }
  }
  return raw;
}
*/

function RuntimeError(msg) {
  var errorDiv = document.getElementById('RuntimeError');
  if (errorDiv) {
    errorDiv.innerHTML = msg;
    errorDiv.style.display = 'block';
  } else {
    alert('RuntimeError: '+msg);
  }
}

function treeFromSWC(swcStr,fileName) {
  var index2type = ['?','soma','axon','dendrite','apical','fork point','end point','custom'];
  // remove single line comments
  var result = swcStr.replace(/\s*#.*?$/mg,'');
  // remove empty lines
  result = result.replace(/^\s*$/mg,'');

  var i,n,p,tp,name,node;
  var root = new node_class({'name':fileName,'type':'root'},[],false)
  var lines = result.split('\n');
  var refCount = [];
  var values;
  for (i=0; i<lines.length; i++) {
    lines[i] = lines[i].replace(/^\s+/m,'').replace(/\s+$/m,'').split(/\s+/);
    values = lines[i];
    if (values.length < 7) continue;
    p = values[6]; // parent point
    if (!refCount[p]) refCount[p] = 1;
    else refCount[p]++;
  }
  var p2node = [];
  for (i=0; i<lines.length; i++) {
    values = lines[i];
    if (values.length < 7) continue;
    n = values[0]; // this point
    p = values[6]; // parent point
    tp = values[1];
    if (tp>7) RuntimeError('Type index must not be larger than 7 in line "'+lines[i]+'"');    
    if (p==-1) {
      name = index2type[tp]
      node = new node_class({'name':root.contourName(name),'type':index2type[tp]},[],root);
      node.tmpSegm = []
    } else {
      node = p2node[p];
      if (refCount[p]>1) {
        if (node.type == 'soma') {
          name = root.branchName(index2type[tp])
        } else {
          name = undefined
        }
        node = new node_class({'name':name,'type':index2type[tp]},[],node);
        node.tmpSegm = []
      }
    }
    p2node[n] = node;
    node.tmpSegm.push([values[2],values[3],values[4],values[5]]);
    if (refCount[n] !== 1) {
      if (node.tmpSegm) {
        node._segm = node.serializeSegment(node.tmpSegm)
        delete node.tmpSegm
      }
    }
  }
  return root;
}

function treeFromNeurolucidaASC(ascStr,fileName) {
  var doParse = true;
  var raw = resultToJSON(ascStr,doParse);
  if (!doParse) {
    document.write('<pre>'+escapeHtml(raw)+'</pre>');
    return;
  }
  var info = {'name':fileName,'type':'root'};
  var i,iStart,v;
  iStart = 0;
  for (var i=0; i<raw.length; i++) {
    v = raw[i];
    if (!v.length) break;
    if (v.length==1) {
      info[v[0].toLowerCase()] = true;
    } else if (v.length==2) {
      info[v[0].toLowerCase()] = v[1];
    } else {
      iStart = i;
      break;
    }
  }
  var root = new node_class(info,[],false);
  for (var i=iStart; i<raw.length; i++) {
    root.addBranchFromRaw(raw[i]);
  }
  return root;
}  

function treeFromNeurolucidaXML(xmlStr,fileName) {
  xmlStr = xmlStr.replace('xmlns="http://www.mbfbioscience.com/2007/neurolucida"','');
  var parser = new DOMParser();
  var xmlDoc = parser.parseFromString(xmlStr,"text/xml");
  var info = { name: fileName, type: 'root' };
  var root = new node_class(info,[],false);
  var contours = xmlDoc.evaluate('/mbf/contour', xmlDoc, null, XPathResult.ANY_TYPE, null);
  var contour = contours.iterateNext();
  while (contour) {
    var v = contour.getAttribute('name')
    info = { 'name': root.contourName(v), 'type': 'contour' };
    if (contour.getAttribute('closed') == "true") info['closed'] = true;
    root.addBranchFromXml(info,contour);
    contour = contours.iterateNext();
  }
  var trees = xmlDoc.evaluate('/mbf/tree', xmlDoc, null, XPathResult.ANY_TYPE, null);
  var treeElem = trees.iterateNext();
  while (treeElem) {
    var type = treeElem.getAttribute('type');
    var leaf = treeElem.getAttribute('leaf');
    info = { 'name':root.branchName(type), 'type': type.toLowerCase() };
    if (leaf) info.leaf = leaf;
    root.addBranchFromXml(info,treeElem);
    treeElem = trees.iterateNext();
  }
  return root;
}

function treeFromNeurolucidaDAT(arrayBuf,fileName) {
  var info = { name: fileName, type: 'root' };
  var root = new node_class(info,[],false);
  var bytes = new DataView(arrayBuf);
  var head = new Uint8Array(arrayBuf,0,70);
  var token = 'V3 DAT file';
  for (var i=0; i<token.length; i++) {
    if (token.charCodeAt(i) != head[i+1]) {
      RuntimeError('File does not have a valid Neurolucida V3 DAT header');
      return root;
    }
  }
  var pos = 70;
  while (pos+8<bytes.byteLength) {
    var tp = bytes.getUint16(pos,true);
    var sz;
    if (tp == 0x0105) {
      sz = bytes.getUint32(pos+2,true);
      var kv = root.V3DAT_parsePropertyList(bytes,pos);
      for (var k in kv) info[k] = kv[k];
    } else if (tp == 0x0201) {
      sz = root.V3DAT_parseContour(bytes,pos);
    } else {
      sz = root.V3DAT_parseBlock(bytes,pos);
    }
    pos += sz;
    if (bytes.getUint32(pos,true) == 0xAABBCCDD) break;
  }
  return root;  
}

/*** HBP Neuroinformatics Platform Integration code ***/

/* Configure the BbpOidcClient and retrieve the current user token.
 * If the user is not authenticated, it will redirect to the HBP auth server
 * and use an OpenID connect implicit flow to retrieve an user access token.
 */
var HBP_authenticate = function() {
  // Setup OpenID connect authentication using the clientId provided
  // in the HBP OIDC client page.
  // https://collab.humanbrainproject.eu/#/collab/54/nav/1051
  var oidcClient = new BbpOidcClient({
    clientId: 'd2e5bc4b-35f1-4934-af64-36e8c25bb596'
  });
  // Retrieve the user token
  return oidcClient.getToken();
}

function HBP_retrieveFile(hbpUuid) {
  var token = HBP_authenticate();
  
  $.ajax('https://services.humanbrainproject.eu/document/v0/api/file/'+hbpUuid, {
    headers: {
      Authorization: 'Bearer ' + token
    }
  })
  .done(function(data) {
    data = JSON.parse(data);
    var fileName = data['_name'];
    $.ajax('https://services.humanbrainproject.eu/document/v0/api/file/'+hbpUuid+'/content', {
      headers: {
        Authorization: 'Bearer ' + token
      }
    })
    .done(function(data) {
      displayResult(data,fileName);
    })
    .fail(function(err) {
      RuntimeError(JSON.stringify(err, null, 2));
    });
  })
  .fail(function(err) {
    RuntimeError(JSON.stringify(err, null, 2));
  });
}
