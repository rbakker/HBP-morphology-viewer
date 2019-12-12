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

/*
 * Dependencies:
 * - swcPlus_typeLibrary.js, which contains the swcPlus Type Library
 * - vkbeautify.js, for producing pretty-print XML
 * 
 * Definitions:
 * - A 'point' is a four-element vector containing x,y,z and radius.
 * - A 'line' is defined as a non-branching set of connected points, 
 *   whereby branching is defined as having multiple children of the 
 *   same Type.
 * - An 'object' is a set of connected lines of the same Type.
 * 
 * Examples:
 * - An axon is an object that consists of lines, with each line
 *   containing one or more points. 
 * - A spine is an object that consists of a single line, which contains
 *   a single point.
 */
"use strict";

const vec3 = {
  sqr: function(x) { 
    return x*x; 
  },
  /* NOT USED
  cross: function(a,b) { 
    return [ a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0] ]
  }
  */
  cross010: function(a) { 
    return [ -a[2], 0, a[0] ];
  },
  // xyz: point to be rotated
  // uvw: rotation axis
  // sin(theta): sine of the rotation angle
  // cos(theta): cosine of the rotation angle
  rotateAboutOrigin: function(x,y,z,u,v,w,sinTheta,cosTheta) {
    var fixed = (u*x+v*y+w*z)*(1-cosTheta);
    var xR = u*fixed+x*cosTheta + (-w*y+v*z)*sinTheta;
    var yR = v*fixed+y*cosTheta + (+w*x-u*z)*sinTheta;
    var zR = w*fixed+z*cosTheta + (-v*x+u*y)*sinTheta;
    return [xR,yR,zR];
  },
  diff: function(a,b) {
    return [b[0]-a[0],b[1]-a[1],b[2]-a[2]];
  },
  norm: function(a) {
    return Math.sqrt(vec3.sqr(a[0])+vec3.sqr(a[1])+vec3.sqr(a[2]));
  },
  normalize: function(a) {
    var norm = vec3.norm(a);
    return norm>0 ? [a[0]/norm,a[1]/norm,a[2]/norm] : a;
  },
  plus: function(a,b) {
    return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  },
  dot: function(a,b) {
    return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  },
  scale: function(a,f) {
    return [a[0]*f,a[1]*f,a[2]*f];
  }
}

const x3d = {
  circle4: [
    [0.000000,1.000000],
    [1.000000,0.000000],
    [0.000000,-1.000000],
    [-1.000000,-0.000000]
  ],
  circle8: [
    [0.000000,1.000000],
    [0.707107,0.707107],
    [1.000000,0.000000],
    [0.707107,-0.707107],
    [0.000000,-1.000000],
    [-0.707107,-0.707107],    
    [-1.000000,-0.000000],
    [-0.707107,0.707107]       
  ],
  circle12: [
    [0.000000,1.000000],
    [0.500000,0.866025],
    [0.866025,0.500000],
    [1.000000,0.000000],
    [0.866025,-0.500000],
    [0.500000,-0.866025],
    [0.000000,-1.000000],
    [-0.500000,-0.866025],
    [-0.866025,-0.500000],
    [-1.000000,-0.000000],
    [-0.866025,0.500000],
    [-0.500000,0.866025]
  ],
  circle24: [
    [0.000000,1.000000],
    [0.258819,0.965926],
    [0.500000,0.866025],
    [0.707107,0.707107],
    [0.866025,0.500000],
    [0.965926,0.258819],
    [1.000000,0.000000],
    [0.965926,-0.258819],
    [0.866025,-0.500000],
    [0.707107,-0.707107],
    [0.500000,-0.866025],
    [0.258819,-0.965926],
    [0.000000,-1.000000],
    [-0.258819,-0.965926],
    [-0.500000,-0.866025],
    [-0.707107,-0.707107],
    [-0.866025,-0.500000],
    [-0.965926,-0.258819],
    [-1.000000,-0.000000],
    [-0.965926,0.258819],
    [-0.866025,0.500000],
    [-0.707107,0.707107],
    [-0.500000,0.866025],
    [-0.258819,0.965926]
  ],
  originRotatedCircle: function(radius,yLevel,u,v,w,sinTheta,cosTheta) {
    var circle = x3d.circle8.slice(0); // clone circle with 12 segments
    for (var i=0;i<circle.length;i++) {
      circle[i] = vec3.rotateAboutOrigin(radius*circle[i][0],yLevel,radius*circle[i][1],u,v,w,sinTheta,cosTheta);
    }
    return circle;
  },
  startCircle: function(a,rA,u_ab) {
    const reverse = u_ab[1]<0;
    if (reverse) u_ab = [-u_ab[0],-u_ab[1],-u_ab[2]];
    var xu = vec3.cross010(u_ab);
    var sinTheta = vec3.norm(xu);
    if (Math.abs(sinTheta) > 1e-8) xu = vec3.scale(xu,1.0/sinTheta);
    else xu = [1,0,0];
    var cosTheta = u_ab[1]; // cos(theta) of u_ab with 0,1,0
    var rc = x3d.originRotatedCircle(rA,0,xu[0],xu[1],xu[2],-sinTheta,cosTheta);
    if (reverse) rc = rc.reverse();
    for (var i=0; i<rc.length; i++) {
      rc[i] = vec3.plus(rc[i],a);
    }
    return rc;
  },
  nextCircle: function(circleA,rA,u_ab,b,rB,u_bc) {
    var u_ac = vec3.normalize(vec3.plus(u_ab,u_bc));
    var denom = vec3.dot(u_ab,u_ac);
    if (denom == 0) denom = 1;
    var circleB = [];
    for (var i=0; i<circleA.length; i++) {
      var a_i = circleA[i];
      var t = vec3.dot(vec3.diff(a_i,b),u_ac)/denom;
      var b_i = vec3.plus(a_i,vec3.scale(u_ab,t));
      if (rB != rA && rA>0) b_i = vec3.plus(b,vec3.scale(vec3.diff(b,b_i),rB/rA));
      circleB.push(b_i);
    }
    return circleB;
  },
  formatSingle: (x) => {
    if (x instanceof Array) return x.map(x3d.formatSingle);
    let [base,exp] = x.toExponential().split('e');
    base = ''+parseFloat(parseFloat(base).toFixed(4));
    exp = parseInt(exp);
    if (exp>=0 && exp<=3) {
      return parseFloat(x.toPrecision(5));
    } else { 
      return base+'e'+exp;
    }
  },
  hex2rgb: (hex) => {
    if (hex[0] == '#') hex = hex.substr(1);
    return [parseInt(hex.substr(0,2),16),parseInt(hex.substr(2,2),16),parseInt(hex.substr(4,2),16)];
  },
  byte2hex: (b) => { 
    return (b<16 ? '0' : '')+Number(b).toString(16);
  },
  rgb2hex: (rgb) => {
    return '#'+x3d.byte2hex(rgb[0])+x3d.byte2hex(rgb[1])+x3d.byte2hex(rgb[2]);
  },
  hex2sfcolor: (hex) => {
    const rgb = x3d.hex2rgb(hex);
    return ''+Math.round(rgb[0]/2.55)/100+' '+Math.round(rgb[1]/2.55)/100+' '+Math.round(rgb[2]/2.55)/100;
  },
  sfcolor2hex: (sfcolor) => {
    const rgb = sfcolor.split(' ');
    return x3d.rgb2hex([Math.floor(rgb[0]*255.999999),Math.floor(rgb[1]*255.999999),Math.floor(rgb[2]*255.999999)])
  },
  capitalize: (s) => {
    return s[0].toUpperCase() + s.slice(1);
  }, 
  promiseProtocolHandler: (fileName) => {
    const parts = fileName.split(/[\/]+/);
    let fileObj;
    while (!fileObj && parts.length>0) {
      fileObj = window.global_imageCache[parts.join('/')];
      parts.shift();
    }
    return new Promise((resolve, reject) => {
      const file2image = (fileObj) => {
        const reader = new FileReader();
        const parts = fileObj.name.split('.');
        const ext = parts[parts.length-1];
        if (ext === 'tif' || ext === 'tiff') {
          reader.onload = () => {
            awaitScript('utif').then( () => {
              const ifds = UTIF.decode(reader.result);
              let img = ifds[0];
              UTIF.decodeImages(reader.result,[img]);
              // render image in canvas, to produce dataUrl
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d");
              const imgData = ctx.createImageData(img.width,img.height);
              imgData.data.set( UTIF.toRGBA8(img) );
              ctx.putImageData(imgData, 0, 0);
              const dataURL = canvas.toDataURL('image/jpeg',0.92);
              window.global_imageCache[fileName] = dataURL;
              resolve(dataURL);
            } );
          }
          reader.readAsArrayBuffer(fileObj);
        } else {
          reader.onload = () => {
            window.global_imageCache[fileName] = reader.result;
            resolve(reader.result);
          }
          reader.readAsDataURL(fileObj);
        }
      }
      if (fileObj) {
        const img = document.createElement('img');    
        if (fileObj instanceof File) {
          file2image(fileObj)
        } else {
          resolve(fileObj); // fileObj already converted to image
        }
      } else {
        const dialog = modalTable('Please supply file "'+fileName+'"');
        const parts = fileName.split('.');
        dialog.addRow().addCell({colSpan:3,style:'text-align:center'},[
          'input', { type: 'button', value: 'Cancel', onclick: () => { dialog.hide(); reject(); } }
        ],' ',[
          'input', { type: 'file', accept: '.'+parts[parts.length-1], onchange: (evt) => { dialog.hide(); file2image((evt || window.event).target.files[0]) } }
        ]);
      }
    });
  }
}

/** 
 * Matrix class with fixed number of rows and columns.
 * @constructor
 * @param {TypedArray_class} dataType - the data type of the matrix elements
 * @param {int} numRows - number of rows
 * @param {int} numCols - number of columns
 */
function matrix_class(dataType,numRows,numCols) {
  this.nR = numRows;
  this.nC = numCols;
  this.dataType = dataType;
  this.data = new dataType(numRows*numCols);
}

/**
 * Returns a matrix row, which can be edited in place.
 * @param {int} r - row to retrieve
 * @returns {TypedArray}
 */
matrix_class.prototype.row = function(r) {
  const i = r*this.nC;
  return this.data.subarray(i,i+this.nC);
}

matrix_class.prototype.lastRow = function() {
  return this.row(this.nR-1);
}

/**
 * Copies the content of `values` into row `r`.
 * @param {int} r - target row
 * @param {Array} values - source values
 */
matrix_class.prototype.setRow = function(r,values) {
  const row = this.row(r);
  row.set(values);
  return row;
}

matrix_class.prototype.toArray = function(numDecimals) {
  const ans = [];
  for (let r=0; r<this.nR; r++) ans.push(Array.from(this.row(r)));
  if (numDecimals !== undefined) {
    const f = parseFloat('1e'+numDecimals);
    for (let r=0; r<this.nR; r++) ans[r] = ans[r].map( function(x) { return Math.round(x*f)/f });
  }
  return ans;
}

matrix_class.prototype.toJson = function() {
  var ans = []
  for (var r=0; r<this.nR; r++) ans.push(JSON.stringify(Array.from(this.row(r))))
  return '['+ans.join('\n')+']'
}

function matrixFromArray(A,dataType) {
  var nR = A.length
  if (!nR) return new matrix_class(dataType,0,0)
  var M = new matrix_class(dataType,nR,A[0].length)
  for (var r=0; r<nR; r++) M.setRow(r,A[r])
  return M
}

/**
 * Matrix class with variable number of rows.
 * @constructor
 * @param {TypedArray} dataType - the data type of the matrix elements
 * @param {int} numCols - number of columns
 */
function varMatrix_class(dataType,numCols) {
  this.nR = 0;
  this.nC = numCols;
  this.blocks = [];
  this.dataType = dataType;
}
  
/**
 * Returns a matrix row, which can be edited in place.
 * If `r` exceeds the number of rows, the matrix is expanded by 256-row increments.
 * @param {int} r - row to retrieve
 * @returns {TypedArray}
 */
varMatrix_class.prototype.row = function(r) {
  var b = (r >> 8);
  var block = this.blocks[b];
  if (!block) 
    block = this.blocks[b] = new this.dataType(256*this.nC);
  if (r >= this.nR) this.nR = r+1;
  var i = (r-(b << 8))*this.nC;
  return block.subarray(i,i+this.nC);
}

varMatrix_class.prototype.lastRow = matrix_class.prototype.lastRow;

varMatrix_class.prototype.setRow = matrix_class.prototype.setRow;

/**
 * Pushes a new row to the matrix with the content of `values`.
 * @param {int} r - target row
 * @param {Array} values - source values
 */
varMatrix_class.prototype.pushRow = function(values) {
  this.setRow(this.nR,values);
  return this.nR-1;
}

/**
  * Converts a varMatrix to a fixed size matrix
  * @returns {matrix_class}
  */
varMatrix_class.prototype.toMatrix = function() {
  var nR = this.nR, nC = this.nC;
  var M = new matrix_class(this.dataType,nR,nC);
  for (var b=0; b<this.blocks.length; b++) {
    var block = this.blocks[b];
    if (!block) continue;
    var r0 = b << 8;
    var r1 = (b+1) << 8;
    if (r1 >= nR) {
      var view = M.data.subarray(r0*nC,nR*nC);
      view.set(block.subarray(0,(nR-r0)*nC));
    } else {
      var view = M.data.subarray(r0*nC,r1*nC);
      view.set(block);
    }
  }
  return M;
}

var bytes_class = function(data,pos) {
  this.data = data;
  this.pos = (pos || 0);
}

/**
 * NeurolucidaDAT blocks have a content-type;
 * this defines a mapping from index to type.
 * @const {map}
 */
bytes_class.prototype.nrlcdTypes = {
  0x0001: 'string',
  0x0040: 'thumbnail',
  0x0101: 'sample',
  0x0102: '0x0102',
  0x0103: 'sampleList',
  0x0104: 'property',
  0x0105: 'propertyList',
  0x0201: 'contour',
  0x0202: 'tree',
  0x0203: 'branch',
  0x0204: 'marker', // wrong bytecount (!)
  0x0205: 'markerList',
  0x0206: 'spine',
  0x0207: 'spineList',
  0x0208: 'text',
  0x0209: 'subtree', // branch that is part of a 'Set'
  0x020D: 'scalebar',
  0x0210: '0x0210', // no purpose (/) and wrong bytecount (!)
  0x0402: 'description',
  0x0403: 'thumbnail'
}

bytes_class.prototype.assertType = function(expectedType,fatal) {
  const tp = this.peekUint16();
  if (expectedType !== undefined) {
    const type = this.nrlcdTypes[tp];
    if (type != expectedType) {
      if (fatal) throw(Error('Neurolucida DAT: Expecting "'+expectedType+'" but got "'+type+'".'));
      return false;
    }
  }
  return true;
}

bytes_class.prototype.readUint8 = function() { this.pos += 1; return this.data.getUint8(this.pos-1,true); }
bytes_class.prototype.readUint16 = function() { this.pos += 2; return this.data.getUint16(this.pos-2,true); }
bytes_class.prototype.readUint32 = function() { this.pos += 4; return this.data.getUint32(this.pos-4,true); }
bytes_class.prototype.readFloat32 = function() { this.pos += 4; return this.data.getFloat32(this.pos-4,true); }
bytes_class.prototype.peekUint8 = function(offset) { return this.data.getUint8(this.pos+(offset || 0),true); }
bytes_class.prototype.peekUint16 = function(offset) { return this.data.getUint16(this.pos+(offset || 0),true); }
bytes_class.prototype.peekUint32 = function(offset) { return this.data.getUint32(this.pos+(offset || 0),true); }
bytes_class.prototype.peekFloat32 = function(offset) { return this.data.getFloat32(this.pos+(offset || 0),true); }


function swcTypeSpec(type,spec) {
  if (!spec) spec = {};
  var update = swcPlus_schema.swcPlus.customTypes[type];
  if (update) {
    for (var k in update) {
      if (k.charAt(0) != '_' && spec[k] === undefined) spec[k] = update[k];
    }
    if (update._extends) spec = swcTypeSpec(update._extends,spec);
  }
  return spec;
}


function tree_class(fileName,swcAttrs,metaData,customTypes,customProperties,points,lines) {
  this.fileName = fileName;
  this.swcAttrs = swcAttrs;
  this.metaData = metaData;
  this.customTypes = customTypes;
  [this.objectProperties,this.pointProperties] = tree_class.inflateProperties(customProperties)
  //this.customProperties = customProperties;
  this.srs = 'local'; // spatial reference system
  /* generate the typeMap, indexed by TypeId */
  var typeMap = {};
  for (var type in customTypes) {
    var ct = tree_class.assertArray(customTypes[type]);
    for (var j=0; j<ct.length; j++) {
      var attrs = this.cloneObject(ct[j]);
      attrs.__type__ = type;
      typeMap[attrs.id] = this.insertDefaults(type,attrs);
    } 
  }
  /* add SWC standard types if not already present */
  typeMap['0'] || (typeMap['0'] = this.insertDefaults('undefined',{}));
  typeMap['1'] || (typeMap['1'] = this.insertDefaults('soma',{}));
  typeMap['2'] || (typeMap['2'] = this.insertDefaults('axon',{}));
  typeMap['3'] || (typeMap['3'] = this.insertDefaults('dendrite',{}));
  typeMap['4'] || (typeMap['4'] = this.insertDefaults('apical',{}));
  
  this.typeMap = typeMap;
  this.points = points;
  this.lines = lines; // each row contains type, firstPoint, numPoints, parentLine, negOffset (counting down from parent's last point)
  // add derived data: properties, children and line names
  this.updateChildren();
  this.updateBoundingBox();
  this.runtimeError = (msg,fatal) => { 
    if (fatal) throw(Error(msg));
    else console.log('Runtime error',msg);
  }
}

tree_class.assertArray = function(a) {
  return a === undefined ? [] : (Array.isArray(a) ? a : [a]);
}
  
tree_class.assertObject = function(a) {
  return typeof a === 'object' ? a : {};
}

tree_class.prototype.updateChildren = function() {
  const lenLines = this.lines.nR;
  const children = new Array(lenLines);
  for (let i=0; i<children.length; i++) children[i] = [];
  // populate children
  var row,p;
  for (let lineId=1; lineId<lenLines; lineId++) {
    row = this.lines.row(lineId);
    children[row[3]].push(lineId);
  }
  this.children = children;
}

/*
 * @class method.
 * Convert sparse set of customProperties, as stored in xml
 * to objectProperties and pointProperties
 */
tree_class.inflateProperties = function(customProperties) {
  const objectProperties = {};
  const pointProperties = {};
  const cp = customProperties && customProperties.for;
  if (cp) for (let i=0; i<cp.length; i++) {
    const o = cp[i].objects;
    const p = cp[i].points;
    const kv = cp[i].set;
    if (o) for (let j=0; j<o.length; j++) {
      const oj = o[j];
      if (!(oj in objectProperties)) objectProperties[oj] = {}; // init op if needed
      for (let k in kv) objectProperties[oj][k] = kv[k];
    }
    if (p) for (let j=0; j<p.length; j++) {
      const pj = p[j];
      if (!(pj in pointProperties)) pointProperties[pj] = {}; // init pp if needed
      for (let k in kv) pointProperties[pj][k] = kv[k];
    }
  }
  return [objectProperties,pointProperties];
}

/*
 * @class method.
 * Convert objectProperties and pointProperties
 * to sparse set of customProperties, as stored in xml
 */
tree_class.compressProperties = function(objectProperties,pointProperties) {
  var idLists = {}
  for (let i=0; i<2; i++) {
    let scope = 'objects';
    let P = objectProperties;
    if (i===1) { scope = 'points'; P = pointProperties || {} };
    for (let k in P) {
      const props = P[k];
      for (var m in props) {
        const propKV = JSON.stringify([m,props[m]]);
        if (!idLists[propKV]) idLists[propKV] = {};
        const il = idLists[propKV];
        if (il[scope]) il[scope].push(parseInt(k));
        else il[scope] = [parseInt(k)];
      }
    }
  }
  const propLists = {};
  for (var propKV in idLists) {
    var idsKey = JSON.stringify(idLists[propKV]);
    if (propLists[idsKey]) propLists[idsKey].push(propKV);
    else propLists[idsKey] = [propKV];
  }
  const customProperties = {};
  for (let idsKey in propLists) {
    const ids = JSON.parse(idsKey);
    const propKVs = propLists[idsKey];
    const propTree = Object.assign({},ids); // points, objects
    propTree['set'] = {};
    for (let i=0; i<propKVs.length; i++) {
      let [k,v] = JSON.parse(propKVs[i]);
      propTree['set'][ k ] = v; // set key-value property
    }
    if (!customProperties.hasOwnProperty('for')) customProperties['for'] = [];
    customProperties['for'].push(propTree);
  }
  return customProperties;  
}



tree_class.prototype.updateBoundingBox = function() {
  var row = this.points.row(1);
  var mn = Array.from(row), mx = Array.from(row);
  for (var r=2; r<this.points.nR; r++) {
    row = this.points.row(r);
    if (mn[0]>row[0]) mn[0] = row[0];
    if (mn[1]>row[1]) mn[1] = row[1];
    if (mn[2]>row[2]) mn[2] = row[2];
    if (mx[0]<row[0]) mx[0] = row[0];
    if (mx[1]<row[1]) mx[1] = row[1];
    if (mx[2]<row[2]) mx[2] = row[2];
  }
  this.boundingBox = {mn:mn,mx:mx};
}

tree_class.prototype.insertDefaults = function(type,attrs) {
  var spec = swcPlus_schema.swcPlus.customTypes[type] || {};
  if (attrs.__type__ === undefined) attrs.__type__ = type;
  for (var k in spec) {
    if (k.charAt(0) != '_' && attrs[k] === undefined && spec[k][0] !== null) attrs[k] = spec[k][0];
  }
  if (spec._extends) attrs = this.insertDefaults(spec._extends,attrs);
  return attrs;
}

tree_class.prototype.cloneObject = function(p) {
  var q = {};
  for (var k in p) q[k] = p[k];
  return q;
}

tree_class.prototype.getTypeName = function(tp,lineId) {
  let name = this.typeMap[tp].name;
  if (name) return this.typeMap[tp].name;
  else {
    const line = this.lines.row(lineId);
    const props = this.objectProperties[line[1]];
    name = props && props.name;
    return name ? name : this.typeMap[tp].__type__; 
  }
}

tree_class.prototype.getType = function(lineId) {
  return this.lines.row(lineId)[0];
}

tree_class.prototype.getLineName = function(lineId) {
  var line = this.lines.row(lineId);
  var p = line[3];
  if (p === lineId) {
    throw(Error('Tree: Line '+lineId+' has itself as parent.'));
  }
  var tp = line[0];
  var p_line = this.lines.row(p);
  var p_tp = p_line[0];
  var p_ch = this.children[p];
  if (tp == p_tp && p) { // same object, but make exception when parent is 0 (root)
    let idx1 = 1;
    for (let c=0; p_ch[c]!=lineId; c++) if (this.getType(p_ch[c]) === tp) idx1++;
    return this.getLineName(p)+'.'+String(idx1);
  } else {
    var count = 1;
    var name = this.getTypeName(tp,lineId);
    for (var c=0; p_ch[c]!=lineId; c++) {
      var row = this.lines.row(p_ch[c]);
      if (this.getTypeName(row[0]) == name) count++;
    }
    if (count == 1) {
      // check if there is only one child with this name
      for (c++; c<p_ch.length; c++) {
        var row = this.lines.row(p_ch[c]);
        if (this.getTypeName(row[0]) == name) return name+' #1';
      }
      return name;
    }
    return name+' #'+count;
  }
}

tree_class.prototype.getLineKey = function(lineId) {
  var line = this.lines.row(lineId);
  var p = line[3];
  if (p == lineId) {
    throw(Error('Tree: Line '+lineId+' has itself as parent.'));
  }
  var tp = line[0];
  var p_line = this.lines.row(p);
  var p_tp = p_line[0];
  var p_ch = this.children[p];
  if (tp == p_tp) {
    return this.getLineKey(p)+String(p_ch.indexOf(lineId)+1);
  } else {
    var count = 1;
    var name = this.typeMap[tp].__type__;
    for (var c=0; p_ch[c]!=lineId; c++) {
      var row = this.lines.row(p_ch[c]);
      if (row[0] == tp) count++;
    }
    return name+'_'+count;
  }
}

tree_class.prototype.getGroups = function(children) {
  var groups = {}
  var ch,r,tp;
  for (var i=0; i<children.length; i++) {
    ch = children[i];
    tp = this.lines.row(ch)[0];
    try {
      r = this.typeMap[''+tp].group;
    } catch(e) {
      this.typeMap[tp] = this.insertDefaults('base',{});
      this.runtimeError('Unknown SWC type '+tp+' on line '+ch+'.');
      r = this.typeMap[0].group;
    }
    groups[r] || (groups[r] = []);
    groups[r].push(ch);
  }
  return groups;
}

tree_class.prototype.getLimits = function(lineId) {
  lineId = (lineId || 0);
  // get limits of current line
  var line = this.lines.row(lineId);
  var mn = Array.from(this.points.row(line[1]));
  mn.pop(); // pop 4-th element (width)
  var mx = Array.from(this.points.row(line[1]));
  mx.pop(); // pop 4-th element (width)
  for (var i=line[1]+1; i<line[1]+line[2]; i++) {
    var pt = this.points.row(i);
    if (pt[0]<mn[0]) mn[0] = pt[0];
    if (pt[1]<mn[1]) mn[1] = pt[1];
    if (pt[2]<mn[2]) mn[2] = pt[2];
    if (pt[0]>mx[0]) mx[0] = pt[0];
    if (pt[1]>mx[1]) mx[1] = pt[1];
    if (pt[2]>mx[2]) mx[2] = pt[2];   
  }
  // combine with limits of child lines
  var children = this.children[lineId];
  for (var c=0; c<children.length; c++) {
    var limits = this.getLimits(children[c]);
    var c_mn = limits[0];
    var c_mx = limits[1];
    if (mn[0]>c_mn[0]) mn[0] = c_mn[0];
    if (mn[1]>c_mn[1]) mn[1] = c_mn[1];
    if (mn[2]>c_mn[2]) mn[2] = c_mn[2];
    if (mx[0]<c_mx[0]) mx[0] = c_mx[0];
    if (mx[1]<c_mx[1]) mx[1] = c_mx[1];
    if (mx[2]<c_mx[2]) mx[2] = c_mx[2];
  }
  return [mn,mx];
}

tree_class.prototype.swcPoints = function(numDecimals,includeLines) {
  let newLines = this.lines;
  const objectProperties = this.objectProperties;
  const pointProperties = this.pointProperties;
  const newObjectProperties = {};
  const newPointProperties = {};
  if (includeLines) {
    // overwrite newLines to include only lineIds from includeLines
    newLines = new varMatrix_class(newLines.dataType,newLines.nC);
    newLines.pushRow(this.lines.row(0)); // start with dummy line
    const newLineIds = {};
    for (let i=0; i<includeLines.length; i++) {
      const lineId = includeLines[i];
      const newLineId = i+1;
      const line = this.lines.row(lineId);
      newLineIds[lineId] = newLineId; // each line contains objectType,startPoint,numPoints,parentLine,negOffset
      // replace parent line by new id
      line[3] = newLineIds[line[3]] || 0;
      newLines.pushRow(line);
    }
  }
  const swcPoints = [];
  const newPointIds = {};
  let newPointId = 1; // start counting at 1
  for (var lineId=1; lineId<newLines.nR; lineId++) {
    let parentPointId = 0;
    const line = newLines.row(lineId);
    const parentLineId = line[3];
    if (parentLineId>0) {
      const parentLine = newLines.row(parentLineId);
      const negOffset = line[4];
      parentPointId = parentLine[1]+parentLine[2]-1-negOffset; // parent firstPoint + numPoints -1 - negative offset
    }
    const tp = line[0];
    const firstPoint = line[1];
    for (let pointId=firstPoint; pointId<firstPoint+line[2]; pointId++) {
      if (pointId in objectProperties) {
        if (pointId !== firstPoint) console.log('Object property assigned to point '+pointId+', but object starts at '+firstPoint);    
        newObjectProperties[firstPoint] = objectProperties[firstPoint];
      }
      if (pointId in pointProperties) newPointProperties[newPointId] = pointProperties[pointId];
      newPointIds[pointId] = newPointId;
      const newParentPointId = newPointIds[parentPointId] || 0
      const point = this.points.row(pointId)
      const rounded = []
      if (numDecimals) {
        const f = parseFloat('1e'+numDecimals)
        for (let j=0; j<4; j++) rounded.push( Math.round(point[j]*f)/f )
      } else {
        rounded = point;
      }
      swcPoints.push([
        newPointId,
        tp,
        rounded[0],
        rounded[1],
        rounded[2],
        rounded[3],
        (newParentPointId || -1)
      ]);
      parentPointId = pointId;
      newPointId += 1;
    }
  }
  const customProperties = tree_class.compressProperties(newObjectProperties,newPointProperties);
  return [swcPoints,customProperties];
}

tree_class.prototype.toJSON = function() {
  const swcDict = this.swcAttrs;
  swcDict.metaData = this.metaData;
  swcDict.customTypes =  this.customTypes
  swcDict.customProperties = tree_class.compressProperties(this.objectProperties,this.pointProperties);
  // internal HBP Morphology Viewer representation
  swcDict.treePoints = {
    columns: 'x,y,z,r',
    data: this.points.toArray(3)
  }
  swcDict.treeLines = {
    columns: 'objectType,startPoint,numPoints,parentLine,negOffset',
    data: this.lines.toArray(3)
  }
  return JSON.stringify(swcDict,null,2)
}
  
tree_class.prototype.toSWC = function(format,includeLines) {
  const swcDict = this.swcAttrs;
  swcDict.metaData = this.metaData;
  swcDict.customTypes =  this.customTypes;
  [swcDict.swcPoints,swcDict.customProperties] = this.swcPoints(3,includeLines);
  if (format == 'jwc') {
    return JSON.stringify(swcDict,null,2);
  } else {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString('<swcPlus></swcPlus>',"text/xml");
    if (format == 'xwc') {
      // xwc format: swc-like XML, with points and lines
      xmlLib.fromDict(xmlDoc.documentElement,swcDict,swcPlus_schema['swcPlus']);
      const xml = (new XMLSerializer()).serializeToString(xmlDoc).replace(/"/g,"'").replace(/&quot;/g,'"');
      return vkbeautify.xml(xml);
    } else {
      // swc format: put XML header in comment section, followed by space-separated points
      const swcPoints = swcDict.swcPoints;
      delete swcDict.swcPoints;
      xmlLib.fromDict(xmlDoc.documentElement,swcDict,swcPlus_schema['swcPlus']);
      const xmlHeader = (new XMLSerializer()).serializeToString(xmlDoc).replace(/"/g,"'").replace(/&quot;/g,'"');
      const swc = ['# '+vkbeautify.xml(xmlHeader).split('\n').join('\n# ')+'\n#'];
      for (var i=0; i<swcPoints.length; i++) {
        swc.push( swcPoints[i].join(' ') );
      }
      return swc.join('\n');     
    }
  }
}

tree_class.prototype.nrlcdLineXml = function(lineId,x3dSettings,includeLines,sidExists,indent) {
  indent = indent || 0; 
  const points = this.points;
  const lines = this.lines;
  const line = lines.row(lineId);
  const tp = line[0]; // type
  const firstPoint = line[1]; // first point
  const numPoints = line[2]; // line length
  const lastPoint = line[1]+line[2]-1;
  const parentLineId = line[3]; // parent line
  const negOffset = line[4];
  const attrs = this.typeMap[tp];
  const swcType = attrs.__type__;
  const geom = attrs.geometry;
  
  const properties = Object.assign({},this.objectProperties[firstPoint]);
  const children = this.children[lineId];

  let xmlOpen = '<unknown>';
  let xmlClose = '</unknown>';
  if (attrs.geometry == 'tree') {
    let a = [];
    let parent;
    if (parentLineId) parent = lines.row(parentLineId);
    if (parent && parent[0] === tp) {
      a.push('<branch');
      if ('leaf' in properties) { a.push('leaf="'+properties.leaf+'"'); delete properties.leaf; }
      xmlClose = '</branch>';
    } else {
      a.push('<tree');
      let color;
      if ('color' in properties) { color = properties.color; delete properties.color; }
      if (!color) {
        x3dSettings = x3dSettings || {};
        if (swcType == 'soma') color = (x3dSettings.somaColor || '#000E600');
        else if (swcType == 'axon') color = (x3dSettings.axonColor || '#0000FF');
        else if (swcType == 'dendrite') color = (x3dSettings.dendriteColor || '#FF0000');
        else if (swcType == 'apical') color = (x3dSettings.apicalColor || '#800000');
      }   
      if (color) a.push('color="'+color.toUpperCase()+'"');
      a.push('type="'+x3d.capitalize(attrs.__type__)+'"');
      if ('leaf' in properties) { a.push('leaf="'+properties.leaf+'"'); delete properties.leaf; }
      xmlClose = '</tree>';
    }
    xmlOpen = a.join(' ')+'>';
  } else if (attrs.geometry == 'contour') {
    const a = ['<contour'];
    if ('name' in attrs) { a.push('name="'+attrs.name+'"'); }
    if ('color' in properties) { a.push('color="'+properties.color.toUpperCase()+'"'); delete properties.color; }
    if ('closed' in properties) { a.push('closed="'+(properties.closed)+'"'); delete properties.closed; }
    if ('shape' in properties) { a.push('shape="'+properties.shape+'"'); delete properties.shape; }
    else a.push('shape="Contour"');
    xmlOpen = a.join(' ')+'>';
    xmlClose = '</contour>';
  } else if (attrs.geometry == 'marker') {
    const isMarker = 'symbolName' in properties;
    let a = [];
    if (isMarker) {
      a.push('<marker');
      if ('name' in properties) { a.push('name="'+properties.name+'"'); delete properties.name; }
      else { a.push('name="'+(properties.varicosity ? 'Varicosity' : 'undefined')+'"'); }
      if ('symbolName' in properties) { a.push('type="'+properties.symbolName+'"'); delete properties.symbolName; delete properties.symbol; delete properties.markerid }
      if ('varicosity' in properties) { a.push('varicosity="'+properties.varicosity+'"'); delete properties.varicosity; }
      xmlClose = '</marker>';
    } else {
      a.push('<text');
      xmlClose = '</text>';
    }
    if ('color' in properties) { a.push('color="'+properties.color.toUpperCase()+'"'); delete properties.color; }    
    xmlOpen = a.join(' ')+'>';
  } else {
    console.log('Unknown attrs',attrs,properties)
  }
  const xml = [xmlOpen];
  let sid;
  if ('sectionId' in properties) {
    sid = properties.sectionId;
    if (!sidExists[sid]) sid = Object.keys(sidExists)[0];
    sid = 'sid="'+sid+'"';
    delete properties.sectionId;
  }
  if ('cellPart' in properties) delete properties.cellPart;
  if ('resolution' in properties) {
    xml.push('\t<resolution>'+properties.resolution+'</resolution>');
    delete properties.resolution;
  }
  if ('fillDensity' in properties) {
    xml.push('\t<property name="FillDensity"><n>'+properties.fillDensity+'</n></property>');
    delete properties.fillDensity;
  }
  if ('font' in properties) { 
    const font = properties.font;
    xml.push('\t<font name="'+(font.name || 'MS Sans Serif')+'" size="'+(font.size || '12')+'"/>');
    delete properties.font;
  }
/*
<property name="Class">
<n>4</n>
<s>mushroom</s>
</property>
<property name="Color">
<c>#0000FF</c>
</property>
<property name="Generated">
</property>
*/  
  if (numPoints) {
    const point = points.row(firstPoint)
    const a = ['\t<point'];
    a.push('x="'+Number(point[0]).toFixed(2)+'"');
    a.push('y="'+Number(point[1]).toFixed(2)+'"');
    a.push('z="'+Number(point[2]).toFixed(2)+'"');
    a.push('d="'+Number(2*point[3]).toFixed(2)+'"'); // convert radius to diameter
    if (sid) a.push(sid);
    xml.push(a.join(' ')+'/>');
  }
  if ('Set' in properties) {
    xml.push('\t<property name="Set"><s>'+properties.Set+'</s></property>');
    delete properties.Set;
  }
  for (let p=firstPoint+1; p<=lastPoint; p++) {
    const point = points.row(p)
    const a = ['\t<point'];
    a.push('x="'+Number(point[0]).toFixed(2)+'"');
    a.push('y="'+Number(point[1]).toFixed(2)+'"');
    a.push('z="'+Number(point[2]).toFixed(2)+'"');
    a.push('d="'+Number(2*point[3]).toFixed(2)+'"'); // convert radius to diameter
    if (sid) a.push(sid);
    xml.push(a.join(' ')+'/>');
  }
  const noChildren = [];
  for (let ch of children) {
    if (!includeLines || includeLines[ch]) {
      const childLine = lines.row(ch);
      if (tp === 1 && childLine[0] !== 1) noChildren.push(ch); // in Neurolucida, soma can't have children
      else xml.push( '\t'+this.nrlcdLineXml(ch,x3dSettings,includeLines,sidExists,indent+1) );
    }
  }
  if ('value' in properties) { 
    xml.push('\t<value>'+properties.value+'</value>');
    delete properties.value;
  }
  xml.push(xmlClose);
  for (let ch of noChildren) xml.push( this.nrlcdLineXml(ch,x3dSettings,includeLines,sidExists,indent) );
  return xml.join('\n'+'\t'.repeat(indent));
}

tree_class.prototype.toNrlcdXml = function(x3dSettings,includeLines) {
  const lines = this.lines;
  let sections = [];
  let props = this.objectProperties[0]
  if (props && props.sections) {
    // obtain section info directly from the 'filefacts'
    sections = props.sections;
  } else {
    // obtain section info from the data
    let haveSection;
    for (let i in this.objectProperties) {
      sectionId = this.objectProperties[i].sectionId;
      if (sectionId !== undefined && !haveSection[sectionId]) {
        haveSection[sectionId] = true;
        sections.push({sid:sid,name:sid,top:sections.length,cutthickness:1,mountedthickness:0});
      }
    }
  }
  const sidExists = {};
  for (let i in sections) sidExists[sections[i].sid] = true;
  let xml = [];
  // ISO-8859-1  
  // <?xml version="1.0" encoding="ISO-8859-1"?>
  // <mbf version="4.0" xmlns="http://www.mbfbioscience.com/2007/neurolucida" xmlns:nl="http://www.mbfbioscience.com/2007/neurolucida" appname="HBP-morphology-viewer" appversion="0.201910">
  xml.push(`<?xml version="1.0" encoding="UTF-8"?>
<mbf version="4.0" xmlns="http://www.mbfbioscience.com/2007/neurolucida" xmlns:nl="http://www.mbfbioscience.com/2007/neurolucida" appname="Neurolucida" appversion="11.11.3 (64-bit)">
<filefacts>`);
  if (sections.length) {
    let top = 0;
    for (let i=0; i<sections.length; i++) {
      const a = ['\t<section'];
      const section = sections[i];
      const sid = section.sid;
      a.push('sid="'+sid+'"');
      a.push('name="'+(section.name || sid)+'"');
      a.push('top="'+(section.top || i)+'"');
      a.push('cutthickness="'+(section.cutthickness || 0)+'"');
      a.push('mountedthickness="'+(section.mountedthickness || 0)+'"');
      xml.push(a.join(' ')+'/>');  
      top += 1;
    }
    const currentSection = props.currentSection || sections[0].name;
    xml.push('\t<sectionmanager currentsection="'+currentSection+'" sectioninterval="1" startingsection="1"/>');
  }
  xml.push(`</filefacts>
<images></images>`);
  if (includeLines) {
    for (let i=0; i<includeLines.length; i++) {
      const lineId = includeLines[i];
      const parent = lines.row(lineId)[3];
      if (!parent) xml.push( this.nrlcdLineXml(lineId,x3dSettings,includeLines,sidExists) );  // children are automatically included
    }
  } else {
    for (let i=1; i<lines.nR; i++) {
      const parent = lines.row(i)[3];
      if (!parent) xml.push( this.nrlcdLineXml(i,x3dSettings,includeLines,sidExists) ); // children are automatically included
    }
  }
  xml.push(`</mbf>`);
  return xml.join('\n')+'\n';
}

tree_class.prototype.lineX3D = function(lineId,x3dSettings,groupOnclick,useDataUrls) {
  const points = this.points;
  const lines = this.lines;
  const line = lines.row(lineId);
  const tp = line[0]; // type
  const firstPoint = line[1]; // first point
  const numPoints = line[2]; // line length
  const lastPoint = line[1]+line[2]-1;
  const parentLineId = line[3]; // parent line
  const attrs = this.typeMap[tp];
  const swcType = attrs.__type__;
  const geom = attrs.geometry;
  
  x3dSettings = x3dSettings || {};
  let color = ('0 0 0');
  if (swcType == 'soma') color = (x3dSettings.somaColor || '0 0.9 0')
  else if (swcType == 'axon') color = (x3dSettings.axonColor || '0 0 1')
  else if (swcType == 'dendrite') color = (x3dSettings.dendriteColor || '1 0 0')
  else if (swcType == 'apical') color = (x3dSettings.apicalColor || '0.5 0 0')
  else if (swcType == 'spine') color = (x3dSettings.spineColor || '0.2 0.8 0')
  else if (geom == 'marker') color = (x3dSettings.markerColor || '0 0 0')
  if (x3dSettings.useColorAttribute) {
    let c, nextLine = line, nextLineId;
    while (!c && nextLine[0] === tp && nextLineId !== nextLine[3]) {
      const props = this.objectProperties[nextLine[1]];
      c = props && props.color;
      nextLineId = nextLine[3];
      nextLine = this.lines.row(nextLineId);
    }
    color = c || color;
  }
  if (color.charAt(0) == '#') color = x3d.hex2sfcolor(color);
  const minNeuriteRadius = 0.5*(x3dSettings.minNeuriteThickness || 0);
  let renderMode = x3dSettings.renderMode || 'thin';
  // draw soma as cones
  if (swcType == 'soma' && geom == 'tree' && (renderMode=='thin' || renderMode=='thick')) renderMode = 'cones';

  let xml = [];
  let promiseUrl;
  // open the x3d shape
  xml.push('<Group'+ (groupOnclick ? ' id="shape_'+lineId+'" onclick="'+groupOnclick+'(event,this)">' : ' DEF="shape_'+lineId+'">'));
  if (geom == 'image') {
    const props = this.objectProperties[firstPoint];
    promiseUrl = 'promise:'+props.filename;
    const scaling = [2752*props.scale[0],2192*props.scale[1],1.0];
    const f = 1/2;
    const center = [props.coord[0]+f*scaling[0],props.coord[1]-f*scaling[1],props.coord[2]];
    xml.push('<Transform translation="'+center.join(' ')+'"><Transform scale="'+scaling.join(' ')+'">');
    xml.push('<Shape><Appearance><ImageTexture repeatS="false" repeatT="false" scale="false" url="'+promiseUrl+'"></ImageTexture></Appearance>');
    xml.push('<IndexedFaceSet solid="false" coordIndex="0 1 2 3">');
    xml.push('<Coordinate point="0.5 0.5 0  -0.5 0.5 0  -0.5 -0.5 0  0.5 -0.5 0"></Coordinate>');
    xml.push('</IndexedFaceSet>');
    xml.push('</Shape></Transform></Transform>');
  } else if (geom == 'contour' || geom == 'marker' || swcType == 'spine' || renderMode == 'thin' || renderMode == 'thick') {
    // geometries are lines
    const coords = [];
    if (geom == 'tree' && parentLineId) {
      var p_line = lines.row(parentLineId);
      var p_firstPoint = p_line[1];
      var p_numPoints = p_line[2];
      var p_lastPoint = p_firstPoint+p_numPoints-1;
      var p_pt = points.row(p_lastPoint);
      coords.push( x3d.formatSingle(p_pt[0])+' '+x3d.formatSingle(p_pt[1])+' '+x3d.formatSingle(p_pt[2]) );
    }
    var mn = this.boundingBox.mn, mx = this.boundingBox.mx;
    const relMarkerSize = x3dSettings.markerSize || 5;
    var markerSize = relMarkerSize/1000*(mx[0]-mn[0]+mx[1]-mn[1]+mx[2]-mn[2]);

    var closed = (geom=='contour');
    if (geom == 'marker') {
      for (var i=firstPoint; i<=lastPoint; i++) {
        var pt = points.row(i);
        xml.push('<Transform translation="'+pt.slice(0,3).join(' ')+'"><Shape><Appearance>'+
          '<Material diffuseColor="'+color+'" specularColor="'+color+'" transparency=".4"></Material></Appearance>'+
          '<Sphere radius="'+0.5*markerSize+'"></Sphere></Shape></Transform>'
        )
      }
    } else {
      xml.push('<Shape><Appearance><Material emissiveColor="'+color+'"></Material>');
      if (renderMode == 'thick') xml.push('<LineProperties linetype="1" linewidthScaleFactor="4" applied="true"></LineProperties>');
      xml.push('</Appearance>');
      for (var i=firstPoint; i<=lastPoint; i++) {
        var pt = points.row(i);
        coords.push( x3d.formatSingle(pt[0])+' '+x3d.formatSingle(pt[1])+' '+x3d.formatSingle(pt[2]) );
      }
      if (closed) coords.push(coords[0]);
      xml.push('<LineSet vertexCount="'+(coords.length)+'" containerField="geometry">');
      xml.push('<Coordinate point="'+coords.join(' ')+'"/>');
      xml.push('</LineSet>');
      xml.push('</Shape>');
    }
  } else if (renderMode.substr(0,5) === 'cones') {
    // geometries are cones, approximated as an indexed face set
    var a,rA,b,rB,c,rC,u_ab,u_bc,skip=0;
    if (parentLineId) {
      var p_line = lines.row(parentLineId);
      var p_firstPoint = p_line[1];
      var p_numPoints = p_line[2];
      var p_lastPoint = p_firstPoint+p_numPoints-1;
      a = Array.from(points.row(p_lastPoint));
      rA = a.pop();
      if (rA < minNeuriteRadius) rA = minNeuriteRadius;
      b = Array.from(points.row(firstPoint));
      rB = b.pop();
      if (rB < minNeuriteRadius) rB = minNeuriteRadius;
      if (p_line[0] != line[0]) rA = rB; // so that axons do not inherit huge radius from soma
    }
    if (!b && numPoints > 0) {
      a = Array.from(points.row(firstPoint));
      rA = a.pop();
      if (rA < minNeuriteRadius) rA = minNeuriteRadius;
      b = Array.from(points.row(firstPoint+1));
      rB = b.pop();
      if (rB < minNeuriteRadius) rB = minNeuriteRadius;
      skip=1;
    }
    if (b) {
      var circles = [];
      u_ab = vec3.normalize(vec3.diff(a,b));
      let circle = x3d.startCircle(a,rA,u_ab);
      circles.push( circle );
      var prevCircle = circle;
      for (var i=firstPoint+skip; i<=lastPoint; i++) {
        if (i<lastPoint) {
          c = Array.from(points.row(i+1));
          rC = c.pop();
          if (rC < minNeuriteRadius) rC = minNeuriteRadius;
          u_bc = vec3.normalize(vec3.diff(b,c));
          if (vec3.dot(u_ab,u_bc)<0) {
            const u_extra = vec3.normalize(vec3.plus(u_ab,u_bc));
            circle = x3d.nextCircle(prevCircle,rA,u_ab,b,rB,u_extra);
            circles.push(circle);
            prevCircle = circle;
            rA = rB;
            u_ab = u_extra;
          }
        } else {
          u_bc = u_ab;
        }
        circle = x3d.nextCircle(prevCircle,rA,u_ab,b,rB,u_bc);
        var corrCircle = [];
        for (var j=0; j<circle.length; j++) {
          if (vec3.dot( vec3.diff(prevCircle[j],circle[j]),u_ab ) < 0) {
            corrCircle.push(prevCircle[j]);
          } else {
            corrCircle.push(circle[j]);
          }
        }
        circles.push(corrCircle);
        rA = rB;
        u_ab = u_bc;
        b = c;
        rB = rC;
        prevCircle = circle;
      }
      // TODO: replace by IndexedTriangleSet
      const coords = [];
      const indices = [];
      circle = circles[0];
      const len = circle.length;
      coords.push( circle.map(function(a) { return x3d.formatSingle( a ).join(' ') }).join(' '));
      for (var i=len-1; i>=0; i--) {
        indices.push(i);
      }
      indices.push(-1);
      var offset = len;
      for (var c=1; c<circles.length; c++) {
        circle = circles[c];
        coords.push(circle.map(function(a) { return x3d.formatSingle( a ).join(' ') }).join(' '));
        if (c==circles.length-1) {
          for (var i=0; i<len; i++) {
            indices.push(offset+i);
          }
          indices.push(-1);
        } 
        for (var i=0;i<len-1;i++) {
          indices.push([offset-len+i+1,offset+i+1,offset+i,offset-len+i].join(' '));
          indices.push(-1);
        }
        indices.push([offset-len,offset,offset+len-1,offset-1].join(' '));
        indices.push(-1);
        offset += len;
      }
      xml.push('<Shape>');
      xml.push('<Appearance><Material diffuseColor="'+color+'" specularColor="1 1 1"></Material>');
      xml.push('</Appearance>');
      xml.push('<IndexedFaceSet creaseAngle="'+(renderMode == 'cones_smooth' ? '1.6' : '0')+'" colorPerVertex="false" coordIndex="'+indices.join(' ')+'" solid="true">');
      xml.push('<Coordinate point="'+coords.join(' ')+'"></Coordinate>');
      xml.push('</IndexedFaceSet>');
      xml.push('</Shape>');
    }
  }
  xml.push('</Group>');
  xml = xml.join('\n'); 
  if (useDataUrls && promiseUrl) {
    return new Promise( (resolve,reject) => {
      x3d.promiseProtocolHandler(promiseUrl.replace('promise:',''))
      .then( (dataUrl) => {
        resolve( xml.replace('url="'+promiseUrl+'"','url="'+dataUrl+'"') );
      } )
    } );
  } else {
    return xml;
  }
}

// idea: use fast X3D by creating a few indexed line sets instead of a thousand line segments.
tree_class.prototype.fastX3D = function(lineId,x3dSettings,coordsByColor,indicesByColor) {
  const points = this.points;
  const lines = this.lines;
  const line = lines.row(lineId);
  const tp = line[0]; // type
  const firstPoint = line[1]; // first point
  const numPoints = line[2]; // line length
  const lastPoint = line[1]+line[2]-1;
  const parentLineId = line[3]; // parent line
  const attrs = this.typeMap[tp];
  const swcType = attrs.__type__;
  const geom = attrs.geometry;
  
  // only include trees and contours etc.
  //if (['tree','contour'].indexOf(geom) == -1) return;
  if (['tree'].indexOf(geom) == -1) return;

  // determine the color of this line
  x3dSettings = x3dSettings || {};
  let color = ('0 0 0');
  if (swcType == 'soma') color = (x3dSettings.somaColor || '0 0.9 0')
  else if (swcType == 'axon') color = (x3dSettings.axonColor || '0 0 1')
  else if (swcType == 'dendrite') color = (x3dSettings.dendriteColor || '1 0 0')
  else if (swcType == 'apical') color = (x3dSettings.apicalColor || '0.5 0 0')
  else if (swcType == 'spine') color = (x3dSettings.spineColor || '0.2 0.8 0')
  else if (geom == 'marker') color = (x3dSettings.markerColor || '0 0 0')
  if (x3dSettings.useColorAttribute) {
    let c, nextLine = line, nextLineId;
    while (!c && nextLine[0] === tp && nextLineId !== nextLine[3]) {
      const props = this.objectProperties[nextLine[1]];
      c = props && props.color;
      nextLineId = nextLine[3];
      nextLine = this.lines.row(nextLineId);
    }
    color = c || color;
  }
  if (color.charAt(0) == '#') color = x3d.hex2sfcolor(color);

  if (!coordsByColor[color]) coordsByColor[color] = [];
  if (!indicesByColor[color]) indicesByColor[color] = [];
  else indicesByColor[color].push(-1);

  const coords = coordsByColor[color];
  const indices = indicesByColor[color];
  if (parentLineId) {
    var p_line = lines.row(parentLineId);
    var p_firstPoint = p_line[1];
    var p_numPoints = p_line[2];
    var p_lastPoint = p_firstPoint+p_numPoints-1;
    var p_pt = points.row(p_lastPoint);
    indices.push( coords.length );
    coords.push( [x3d.formatSingle(p_pt[0]), x3d.formatSingle(p_pt[1]), x3d.formatSingle(p_pt[2])] );
  }

  for (var i=firstPoint; i<=lastPoint; i++) {
    var pt = points.row(i);
    indices.push( coords.length );
    coords.push( [x3d.formatSingle(pt[0]), x3d.formatSingle(pt[1]), x3d.formatSingle(pt[2])] );
  }
  // return true to indicate that the line is included
  return true;
}

tree_class.prototype.toX3D = function(x3dSettings,groupOnclick,useDataUrls) {
  const lines = this.lines;
  x3dSettings = x3dSettings || {};
  const backgroundColor = x3dSettings.backgroundColor || '#FFFFFF';
  let xml = [];
  xml.push(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 3.3//EN"
  "http://www.web3d.org/specifications/x3d-3.3.dtd">
<X3D xmlns:xsd="http://www.w3.org/2001/XMLSchema-instance" profile="Interactive" version="3.3" xsd:noNamespaceSchemaLocation="http://www.web3d.org/specifications/x3d-3.3.xsd">
  <Scene>
    <navigationInfo type="&quot;EXAMINE&quot; &quot;FLY&quot; &quot;ANY&quot;" speed="4" headlight="true" avatarSize="0.25 1.6 0.75" transitionTime="1" transitionType="LINEAR "/>
    <Viewpoint DEF="X3D-viewpoint" description="X3D-viewpoint" position="-20 0 0" orientation="-0.57735 0.57735 0.57735 4.1887" fieldOfView="0.785398" centerOfRotation="0 0 0"/>
    <Background skyColor="`+backgroundColor+`" groundColor="" groundAngle="" skyAngle="" backUrl="" bottomUrl="" frontUrl="" leftUrl="" rightUrl="" topUrl=""/>
    <Transform DEF="ATLAS_SPACE" render="true" bboxCenter="0 0 0" bboxSize="-1 -1 -1" center="0 0 0" translation="0 0 0" rotation="0 0 0 0" scale="1 1 1" scaleOrientation="0 0 0 0">
  `);
  if (x3dSettings.fastX3d) {
    const coordsByColor = {};
    const indicesByColor = {};
    for (let i=0; i<lines.nR; i++) {
      this.fastX3D(i,x3dSettings,coordsByColor,indicesByColor);
    }
    const renderMode = x3dSettings.renderMode;
    for (let color in coordsByColor) {
      xml.push('<Group'+ (groupOnclick ? ' id="color_'+color+'" onclick="'+groupOnclick+'(event,this)">' : ' DEF="color_'+color+'">'));
      xml.push('<Shape><Appearance><Material emissiveColor="'+color+'"></Material>');
      if (renderMode == 'thick') xml.push('<LineProperties linetype="1" linewidthScaleFactor="4" applied="true"></LineProperties>');
      xml.push('</Appearance>');
      xml.push('<IndexedLineSet coordIndex="'+indicesByColor[color].join(' ')+'" containerField="geometry">');
      xml.push('<Coordinate point="'+coordsByColor[color].join(' ')+'"/>');
      xml.push('</IndexedLineSet>');
      xml.push('</Shape>');
      xml.push('</Group>');
    }
  } else {
    for (let i=0; i<lines.nR; i++) {
      const line = lines.row(i);
      const tp = line[0];
      if (tp < 16) {
        const next = xml.length;
        xml.push( this.lineX3D(i,x3dSettings,groupOnclick,useDataUrls) )
      }
    }
  }
  xml.push(`
    </Transform>
  </Scene>
</X3D>`);
  if (useDataUrls) {
    return Promise.all(xml);
  } else {
    return xml.join('\n');
  }
}

tree_class.prototype.rounded = function(x,numDecimals) {
  let rounded = []
  const f = parseFloat('1e'+numDecimals)
  for (let i=0; i<x.length; i++) rounded.push( Math.round(x[i]*f)/f )
  return rounded
}

tree_class.prototype.toNeuroML2 = function() {
  const numDecimals = 3
  const parser = new DOMParser()
  let xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<neuroml xmlns="http://www.neuroml.org/schema/neuroml2"',
    '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '    xsi:schemaLocation="http://www.neuroml.org/schema/neuroml2  https://raw.githubusercontent.com/NeuroML/NeuroML2/master/Schemas/NeuroML2/NeuroML_v2beta4.xsd">',
    '  <!-- Exported by the HBP Morphology Viewer https://neuroinformatics.nl/HBP/morphology-viewer -->',
    '  <cell id="'+this.fileName.replace('"','&quote;')+'">',
    '    <morphology id="...">'
  ]
  let typeCounter = {}

  var id = 0
  const lenLines = this.lines.nR
  for (var lineId=1; lineId<lenLines; lineId++) {
    const line = this.lines.row(lineId)
    const p = line[3]
    const negOffset = line[4]
    let iParent = -1
    let proximal = null
    let skipFirst = 0
    if (p<=0) {
      proximal = this.rounded( this.points.row(line[1]),numDecimals )
    } else {
      var parent = this.lines.row(p)
      iParent = parent[1]+parent[2]-1-negOffset
      const parentPoint = this.points.row(iParent)
      proximal = this.rounded(parentPoint) 
    }
    const lineName = this.getLineName(lineId)
    const tp = line[0]
    const typeKey = this.typeMap[tp].__type__
    if (!typeCounter[tp]) typeCounter[tp] = 0
    const lineKey = this.getLineKey(lineId)
    for (var i=line[1]+skipFirst; i<line[1]+line[2]; i++) {
      id += 1
      typeCounter[tp]++
      const distal = this.rounded( this.points.row(i),numDecimals )
      xml.push('<segment id="'+i+'" name="'+lineKey+'_'+String(i-line[1])+'">')
      if (iParent>0) xml.push('<parent segment="'+iParent+'"/>')
      if (proximal) {
        xml.push('<proximal x="'+proximal[0]+'" y="'+proximal[1]+'" z="'+proximal[2]+'" diameter="'+2*distal[3]+'"/>')
        proximal = null
      }
      xml.push('<distal x="'+distal[0]+'" y="'+distal[1]+'" z="'+distal[2]+'" diameter="'+2*distal[3]+'"/>')
      xml.push('</segment>')

      iParent = i
    }
  }

  xml.push(
    '    </morphology>',
    '  </cell>',
    '</neuroml>'
  )
  xml = xml.join('\n')
  return vkbeautify.xml(xml)
}

tree_class.prototype.applyTransformation = function(method,toSrs) {
  var metaData = VIEWER.tree.metaData
  var spatialRegistration = metaData.spatialRegistration
  var fromSrs = this.srs
  var tfList = tree_class.assertArray(spatialRegistration && spatialRegistration.transformation)
  // find the proper transform
  for (var i=0; i<tfList.length; i++) {
    var tf = tfList[i]
    if (tf.transform == method && tf.fromSrs == fromSrs && tf.toSrs == toSrs) break
  }
  if (i<tfList.length) {
    var Ab0 = tf.Ab[0], Ab1 = tf.Ab[1], Ab2 = tf.Ab[2]
    var a = Ab0[0], b = Ab0[1], c = Ab0[2], 
      d = Ab1[0], e = Ab1[1], f = Ab1[2],
      g = Ab2[0], h = Ab2[1], i = Ab2[2]
    var detA_3 = Math.pow(Math.abs( a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g) ),1/3)
    for (var r=1; r<this.points.nR; r++) {
      // note: zeroth point is a dummy
      var pt = Array.from(this.points.row(r))
      this.points.setRow(r,[
        Ab0[0]*pt[0]+Ab0[1]*pt[1]+Ab0[2]*pt[2]+Ab0[3],
        Ab1[0]*pt[0]+Ab1[1]*pt[1]+Ab1[2]*pt[2]+Ab1[3],
        Ab2[0]*pt[0]+Ab2[1]*pt[1]+Ab2[2]*pt[2]+Ab2[3],
        pt[3]*detA_3
      ])
    }
    this.srs = toSrs
    console.log('The morphology has been transformed to "'+toSrs+'"')
    this.updateBoundingBox()
    return true
  } else {
    console.log('No suitable transformation found.')
    return false
  }
}
  
var xmlLib = {
  attributes: function (xmlElem) {
    const a = xmlElem.attributes;
    const attrs = {};
    if (a) for (var i=0; i<a.length; i++) {
      let a_i = a[i];
      attrs[a_i.name] = a_i.value;
    }
    return attrs;
  },
  /**
   * triplet: tagName | attributes | childTriplets or innerText
   */
  toTriplets: function(xmlNodeCollection) {
    var triplets = []
    for (var i=0; i<xmlNodeCollection.length; i++) {
      var elem = xmlNodeCollection[i]
      const Node_TEXT_NODE = 3
      const Node_COMMENT_NODE = 8
      if (elem.nodeType == Node_COMMENT_NODE) ;
      else if (elem.nodeType == Node_TEXT_NODE) {
        var s = elem.data.replace(/\s+/,'')
        if (s) triplets.push(elem.data) // xmlUnescape(elem.data)
      } else {
        var childTriplets = xmlLib.toTriplets(elem.childNodes)
        triplets.push([
          elem.tagName,
          xmlLib.attributes(elem),
          childTriplets
        ])
      }
    }
    return triplets
  },
  /**
   * Conversion from XML to dict;
   * the order of the elements is lost
   * and attributes overwrite child-elements with the same name
   */
  toDict: function(xmlNodeCollection) {
    const dict = {};
    for (let i=0; i<xmlNodeCollection.length; i++) {
      const elem = xmlNodeCollection[i];
      let tagName, childDict;
      const Node_TEXT_NODE = 3;
      const Node_COMMENT_NODE = 8;
      if (elem.nodeType == Node_COMMENT_NODE) ; // skip
      else if (elem.nodeType == Node_TEXT_NODE) {
        // ignore whitespace-only text
        if (!elem.data.trim().length) continue;
        tagName = '_';
        childDict = elem.data;
      } else {
        tagName = elem.tagName;
        childDict = xmlLib.toDict(elem.childNodes);
        const attrs = xmlLib.attributes(elem);
        // if (tagName.substr(-5,5) == '.json') 
        for (var k in attrs) {
          if (k.substr(-5,5) == '.json') {
            childDict[k.substr(0,k.length-5)] = JSON.parse(attrs[k]);
          } else if (k.substr(-4,5) == '.csv') {
            childDict[k.substr(0,k.length-4)] = JSON.parse('['+attrs[k]+']');
          } else {
            childDict[k] = attrs[k];
          }
        }
      }
      if (dict[tagName]) {
        dict[tagName] = tree_class.assertArray(dict[tagName]);
        dict[tagName].push(childDict);
      } else {
        dict[tagName] = childDict;
      }
    }
    return dict;  
  },
  /**
   * Computed style for the conversion of xml to js(on)
   * rules: array of rules.
   *    Field rule.xpath indicates elements for which the rule applies;
   *    additionally the rule can have fields type, keyFrom, tagAs.
   *    Rules are applied in order of appearance.
   * path: the full path of the element, using part of xpath syntax.
   *    Valid constructs are:
   *    /selector/pattern1 => applies to element 'selector/pattern1' starting from root
   *    /selector/pattern2/* => applies to all children of element 'selector/pattern2' starting from root
   *    selector/pattern3 => applies to element 'selector/pattern3' starting anywhere in path
   *    selector/pattern4/* => applies to all children of element 'selector/pattern4', starting anywhere in path
   **/
  computedStyle: function(rules,path) {
    // assume that path always starts and ends with '/'
    const style = {};
    for (let i=0; i<rules.length; i++) {
      const rule = rules[i];
      let s = rule.xpath;
      if (!s) return style;
      let match = false;
      if (s === '*') match = true;
      else if (s[0] === '/') {
        // single slash: start from root
        if (s.substr(s.length-1) === '*') {
          // path starts with s and extends beyond s
          s = s.substr(0,s.length-1);
          if (s[s.length-1] !== '/') s += '/';
          if (path.substr(0,s.length) === s && path.length > s.length) match = true;
        } else {
          // path is equal to s
          if (s[s.length-1] !== '/') s += '/';
          if (path === s) match = true;
        }
      } else {
        // start anywhere
        if (s.substr(s.length-1) === '*') {        
          // path contains s and extends beyond s
          s  = '/'+s.substr(0,s.length-1);
          if (s[s.length-1] !== '/') s += '/';
          const idx = path.indexOf(s);
          if (idx >= 0 && path.length > idx + s.length) match = true;
        } else {
          // path ends with s
          if (s[s.length-1] !== '/') s += '/';
          if (path.substr(path.length-s.length) === s) match = true;
        }
      }
      if (match) {
        for (let r in rule) if (r !== 'xpath') style[r] = rule[r]; 
      }
    }
    return style;
  },
  /**
   * Conversion from XML to recursive list.
   * Preserves the order of elements.
   * xmlNode: xml element
   * x2j: set of rules to convert xml to js(on)
   * path: path to reach element
   * 
   * Example:
   * <items>
   *   <item id="1">item1</item>
   *   <item id="2">item2</item>
   * </items>
   * 
   * x2j = [
   *   { xpath: 'items/*', keyFrom:'id' }
   * ]
   * 
   * should result in
   * [
   *   { items:
   *     { 
   *       "1": ["item1"],  
   *       "2": ["item2"]
   *     }
   *   }
   * ] 
   */
  toJ: function(xmlNode,x2j,path) {
    const Node_TEXT_NODE = 3;
    const Node_COMMENT_NODE = 8;
    if (xmlNode.nodeType == Node_COMMENT_NODE) return undefined; // skip
    if (xmlNode.nodeType == Node_TEXT_NODE) {
      // ignore whitespace-only text
      if (!xmlNode.data.trim().length) return undefined;
      return xmlNode.data;
    }
    // regular xml-element
    path = path || '/'+xmlNode.tagName+'/';
    x2j = x2j || [];
    const style = xmlLib.computedStyle(x2j,path);
    const keyFrom = style.keyFrom;
    const tagAs = style.tagAs;
    
    const tag = xmlNode.tagName;
    const attrs = xmlLib.attributes(xmlNode);
    if (tagAs) attrs[tagAs] = tag;
    let key = tag;
    if (keyFrom && keyFrom in attrs) {
      key = attrs[keyFrom];
      delete attrs[keyFrom];
    }

    const raw = [];
    // deal with data in json- or csv-encoded attributes
    for (var k in attrs) {
      let decode = false
      let ch = {};
      if (k.substr(-5,5) == '.json') {
        decode = true;
        ch[ k.substr(0,k.length-5) ] = JSON.parse(attrs[k]);
      } else if (k.substr(-4,5) == '.csv') {
        decode = true;
        ch[ k.substr(0,k.length-4) ] = JSON.parse('['+attrs[k]+']');
      }
      if (decode) {
        raw.push(ch);
        delete attrs[k];
      }
    }
    const numAttrs = Object.keys(attrs).length;
    const childNodes = xmlNode.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const ch = childNodes[i];
      const chJ = xmlLib.toJ(ch,x2j,path+ch.tagName+'/');
      if (chJ !== undefined) raw.push( chJ );
    }

    // convert to requested type
    const types = style.type.split('|');
    let parsed;
    let errors;
    for (let t=0; t<types.length; t++) {
      // try multiple types and use the first without errors
      const type = types[t];
      const forced = (type[0] === '!');
      if (forced) type = type.substr(1);
      parsed = undefined;
      errors = [];
      if (type === 'text' || type === 'string' || type === 'number') {
        parsed = '';
        for (let i=0; i<raw.length; i++) {
          if (typeof raw[i] === 'string') parsed += (type === 'number' ? parseFloat(raw[i]) : raw[i]);
          else errors.push(raw[i]); // throw away non-strings
        }
        if (numAttrs) errors.push(attrs);
      } else if (type === 'list') {
        // throw away tag name (but see tagAs) 
        parsed = [];
        for (let i=0; i<raw.length; i++) {
          const elem = raw[i];
          if (elem instanceof Object) {
            let first = true;
            for (k in elem) {
              if (first) parsed.push(elem[k]);
              else errors.push(elem[k]); // throw away any further members
              first = false;
            }
          } else {
            errors.push(elem); // throw away non-objects
          }
          if (numAttrs) for (let k in attrs) parsed[k] = attrs[k];
        }
      } else if (type === 'dict') {
        parsed = attrs;
        for (let i=0; i<raw.length; i++) {
          const elem = raw[i];
          if (elem instanceof Object) {
            for (k in elem) {
              if (k in parsed) errors.push(elem[k]);
              else parsed[k] = elem[k];
            }
          } else {
            errors.push(elem); // throw away non-objects
          }
        }
      } else {
        parsed = null;
        errors.push("Invalid type '"+type+"'");
      }
      if (forced || errors.length === 0) {
        continue;
      }
    }
    // save result
    const result = {};
    if (parsed !== undefined) {
      result[key] = parsed;
      if (errors.length > 0) result['__errors__'] = errors;
    } else {
      if (numAttrs) raw.attributes = attrs;
      result[key] = raw;
    }
    return result;  
  },
  /**
   * Conversion of dict to XML, whereby scalar values become attributes, 
   * arrays and child-dicts become child-elements
   */
  fromDict: function(xmlNode,dict,schema) {
    const xmlDoc = xmlNode.ownerDocument;
    if (!schema) schema = {}
    const isScalar = (x) => {
      return ['number','string','boolean','null'].indexOf(typeof x) > -1;
    }
    const isSimple = (x) => {
      return ['number','string'].indexOf(typeof x) > -1
    }
    const isNumericArray = (a) => {
      return a.every( function(x) { return typeof x == 'number' } )
    }
    const isScalarArray = (a) => {
      return a.every( function(x) { return isScalar(x) } )
    }
    const isScalarArrayArray = (aa) => {
      return aa.every(function(a) { return Array.isArray(a) && isScalarArray(a) })
    }
    if (typeof dict != 'object' || Array.isArray(dict)) {
      // fix invalid dictionary
      dict = { '_':dict }
    }
    let elem, k,k0,v, useAttribute;
    for (k in dict) {
      v = dict[k];
      k0 = k = k.trim();
      useAttribute = undefined;
      try {
        // make sure k is a valid tag/attribute name
        xmlDoc.createElement(k);
      } catch(e) {
        // otherwise do the .json trick 
        k = '_.json';
        v = JSON.stringify({k:v});
      }
      // choose most compact notation
      if (Array.isArray(v)) {
        // convert numeric arrays to csv
        if (isNumericArray(v)) {
          k += '.csv';
          v = v.join(',');
        } else if (isScalarArray(v)) {
          k += '.json';
          v = JSON.stringify(v.map(JSON.stringify),[],2);
        } else if (isScalarArrayArray(v)) {
          k += '.json';
          v = JSON.stringify(v).replace(/\],\[/g,'],\n[');
        }
      }
      // check schema to see if attribute must be used instead of element
      if (schema[k0]) {
        useAttribute = Array.isArray(schema[k0]);
        if (useAttribute && !isSimple(v)) {
          k += '.json';
          v = JSON.stringify(v);
        }
      }
       
      if (typeof v == 'object') {
        if (Array.isArray(v)) {
          // create multiple elements with the same tag name
          for (let i=0; i<v.length; i++) {
            const v_i = v[i];
            if (typeof v_i == 'object' && !Array.isArray(v_i)) {
              // apply fromDict recursively
              elem = xmlDoc.createElement(k);
              xmlLib.fromDict(elem,v_i,schema[k0]);
            } else {
              if (!isSimple(v_i)) {
                k += '.json';
                v_i = JSON.stringify(v_i);
              }
              elem = xmlDoc.createElement(k);
              elem.appendChild(xmlDoc.createTextNode(v_i));
            }
            xmlNode.appendChild(elem);
          }
        } else {
          // apply fromDict recursively
          elem = xmlDoc.createElement(k);
          xmlLib.fromDict(elem,v,schema[k0]);
          xmlNode.appendChild(elem);
        }
      } else {
        if (!isSimple(v)) {
          k += '.json';
          v = JSON.stringify(v);
        }
        if (k == '_') {
          xmlNode.appendChild( xmlDoc.createTextNode(v) );
        } else if (useAttribute === false) {
          elem = xmlDoc.createElement(k);
          elem.appendChild( xmlDoc.createTextNode(v) );
          xmlNode.appendChild(elem);
        } else {
          // create compact XML with attributes
          xmlNode.setAttribute(k,v);
        }
      }
    }
  },
  /**
   * triplet: tagName | attributes | childTriplets or innerText
   */
  fromTriplets: function(xmlNode,triplets,xsdSpec) {
    var xmlDoc = xmlNode.ownerDocument
    for (var i=0; i<triplets.length; i++) {
      var triplet = triplets[i]
      if (typeof triplet == 'string') {
        var innerText = triplet
        var elem = xmlDoc.createTextNode(innerText)
      } else {
        var elem = xmlDoc.createElement(triplet[0])
        var attrTypes = xsdSpec[triplet[0]]
        var attrs = triplet[1]
        for (var k in attrs) {
          var attr = attrs[k]
          var attrType = attrTypes[k] && attrTypes[k][1] // the attribute type according to the xsd schema
          if (!attrType && typeof attr == 'object') attrType = 'jsonType'
          if (attrType == 'jsonType') {
            k += '.json'
            attr = JSON.stringify(attr)
          } else if (attrType == 'csvType') {
            attr = JSON.stringify(attr)
            if (attr.substr(0,1) == '[') attr = attr.slice(1,-1)
            else 'Error: csvType element must be an Array, not '+attr
          }
          elem.setAttribute(k,attr)
        }
        var childTriplets = triplet[2]
        xmlLib.fromTriplets(elem,childTriplets,xsdSpec)
      }
      xmlNode.appendChild(elem)
    }
  },
  xPath: function(xmlDoc,query) {
    if (xmlDoc.selectNodes) return xmlDoc.selectNodes(query)
    else if (xmlDoc.evaluate) return xmlDoc.evaluate(query,xmlDoc,null,XPathResult.ANY_TYPE,null)
    else return xpath.select(query,xmlDoc)
  }
}

function swc_class() {
}

swc_class.prototype.parsePoints = function(swcPoints,fileName,tryStandardize) {
  // use long arrays to store sample indices
  const numSamples1 = swcPoints.length+1;
  const longArray = numSamples1<=65536 ? Uint16Array : Uint32Array;
  let point$ = new matrix_class(Float32Array,numSamples1,4);
  const parent$ = new Uint32Array(numSamples1);
  const type$ = new Uint16Array(numSamples1);
  const point2sample = new Uint32Array(numSamples1);
  let pointIndex = 0; // skips invalid lines
  let minSample, maxSample;
  for (let i=1; i<numSamples1; i++) {
    const values = swcPoints[i-1];
    if (values.length < 7) {
      console.log('File "'+fileName+'": Skipping line '+JSON.stringify(values)+': need 7 values.');
      continue;
    }

    const s = values[0]; // swc sample id
    if (s<0) {
      console.log('File "'+fileName+'": Sample# must be larger than or equal to zero.')
      break
    }
    if (minSample>s || minSample === undefined) minSample = s;
    if (maxSample<s || maxSample === undefined) maxSample = s;

    pointIndex += 1;
    point2sample[pointIndex] = s;
    const point = point$.row(pointIndex);
    for (var j=0; j<4; j++) point[j] = values[2+j];
    const sParent = values[6]; // parent sample id
    parent$[pointIndex] = (sParent >= 0 && sParent != s) ? sParent : 0; // 0 indicates no parent (root)
    type$[pointIndex] = values[1];
  }
  const numValidPoints1 = pointIndex+1;
  // map sample numbers to sample indices
  let sample2point = point2sample;
  let nontrivial = false
  for (let p=1; p<numValidPoints1; p++) {
    if (point2sample[p]-minSample+1 != p) { nontrivial=true; break }
  }
  if (nontrivial) {
    console.log('Non-trivial sampling in file '+fileName)
    sample2point = (maxSample-minSample+1 <= swcPoints.length ? new longArray(numSamples1) : {})
    for (let p=1; p<numValidPoints1; p++) {
      const s = point2sample[p]-minSample+1;
      sample2point[s] = p
    }
  }
  if (nontrivial || minSample !== 1) {
    for (let p=1; p<numValidPoints1; p++) {
      parent$[p] = sample2point[parent$[p]-minSample+1];
    }
  }

  // determine whether each sample has single or multiple children of its own type
  const singleChild$ = new longArray(numValidPoints1);
  const isFork$ = new Uint8Array(numValidPoints1);
  isFork$[0] = 1; // root is always a fork
  let numLines1 = 1;
  for (let p=1; p<numValidPoints1; p++) {
    const sParent = parent$[p];
    if (isFork$[sParent]) {
      numLines1 += 1; // existing fork: one new line
    } else {
      if (type$[p] == type$[sParent]) {
        if (singleChild$[sParent]) {
          numLines1 += 2; // new fork: two new lines
          singleChild$[sParent] = 0;
          isFork$[sParent] = 1;
        } else {
          singleChild$[sParent] = p;
        }
      } else {
        numLines1 += 1; // type switch: one new line
      }
    }
  }
  
  // map points to lines
  let line$ = new matrix_class(longArray,numLines1,5);
  const point2line$ = new longArray(numValidPoints1);
  let lineIndex = 0;
  for (let p=1; p<numValidPoints1; p++) {
    const pParent = parent$[p]; // parent point id
    const pType = type$[p];
    const pParentType = type$[pParent]
    if (isFork$[pParent] || pType != pParentType) {
      lineIndex += 1; // existing fork: one new line
      var line = line$.row(lineIndex);
      line[0] = pType; // line type
      line[1] = p; // line start point
      var len = 0;
      for (var pLine=p; pLine!==0; pLine=singleChild$[pLine]) {
        point2line$[pLine] = lineIndex;
        len++;
      }
      line[2] = len; // end minus start point // CORRECTED
      line[4] = pParent; // parent point (later becomes: remainingPoints)
    }
  }
  // get parent line from parent point
  for (let l=1; l<numLines1; l++) {
    const line = line$.row(l);
    const lParent = point2line$[line[4]]; // parent line id
    line[3] = lParent;
    var parentLine = line$.row(lParent);
    if (parentLine && parentLine[2]) {
      var lastPointParent = parentLine[1]+parentLine[2]-1;
      // line[4] represents remainingPoints: 0 means that it connects to the last point of its parent line
      line[4] = lastPointParent-line[4];
    } else {
      line[4] = 0;
    }
  }
  
  if (tryStandardize) {
    // sort lines in canonical order
    var sortBy = [[]]
    for (let l=1; l<numLines1; l++) {
      var id = [l];
      for (let lParent=line$.row(l)[3]; lParent; lParent=line$.row(lParent)[3]) {
        id.unshift(lParent) // parent line
      }
      sortBy.push(id)
    }
    sortBy.sort(function(a,b){
      var len=a.length>b.length?b.length:a.length
      for(var i=0;i<len;i++) {
        if (a[i]!=b[i]) return a[i]-b[i]
      }
      return a.length-b.length
    })
    let permuteLine$ = false;
    for (let r=1; r<sortBy.length; r++) {
      const s = sortBy[r].pop();
      if (r != s) { 
        if (!permuteLine$) permuteLine$ = new longArray(numLines1);
        permuteLine$[s] = r;
      }
    }
    if (permuteLine$) {
      const sorted$ = new matrix_class(longArray,numLines1,5);
      for (let s=1; s<numLines1; s++) {
        const r = (permuteLine$[s] || s);
        const row = sorted$.setRow(r,line$.row(s));
        const p = row[3];
        row[3] = (permuteLine$[p] || p); // also permute line's parent line
      }
      line$ = sorted$;
      console.log('File "'+fileName+'": Lines permuted to canonical order.');
    }

    // sort points in canonical order
    var permutePoint$ = false;
    var numSorted = 0;
    for (let s=1; s<numLines1; s++) {
      const i = line$.row(s)[1];
      for (let iSeq=i; iSeq!==0; iSeq=singleChild$[iSeq]) {
        numSorted += 1;
        if (numSorted != iSeq) {
          if (!permutePoint$) permutePoint$ = new longArray(numSamples1);
          permutePoint$[iSeq] = numSorted;
        }
      }
    }  
    if (permutePoint$) {
      var sorted$ = new matrix_class(Float32Array,numSamples1,4)
      for (let i=1; i<numSamples1; i++) {
        var r = permutePoint$[i];
        if (!r) { r = permutePoint$[i] = i }
        sorted$.setRow(r,point$.row(i));
      }
      point$ = sorted$;
      for (let s=1; s<numLines1; s++) {
        var line = line$.row(s);
        line[1] = permutePoint$[line[1]]; // permute line's start point
      }
      console.log('File "'+fileName+'": Points permuted to canonical order.');
    }
  }
  return [point$,line$];
}

swc_class.prototype.treeFromSwcJson = function(parsedJson,fileName) {
  const points = matrixFromArray(parsedJson.treePoints.data,Float32Array)
  const lines = matrixFromArray(parsedJson.treeLines.data,Uint32Array)
  return new tree_class(fileName,{version:parsedJson.version},parsedJson.metaData,parsedJson.customTypes,parsedJson.customProperties,points,lines);
}

swc_class.prototype.treeFromStreamlinesJson = function(parsedJson,fileName) {
  const pointsData = [[0,0,0,0]]; // first element is dummy
  const linesData = [[0,0,0,0,0]]; // first element is dummy
  const injectionblob = parsedJson.injection_sites;
  const streamlines = parsedJson.lines;
  let nextPoint = pointsData.length;
  for (let i=0; i<injectionblob.length; i++) {
    const point = injectionblob[i];
    linesData.push([17,nextPoint,1,0,0]);
    pointsData.push([point.x,point.y,point.z,1]);
    nextPoint += 1;
  }
  nextPoint = pointsData.length;
  for (let i=0; i<streamlines.length; i++) {
    const line = streamlines[i];
    linesData.push([2,nextPoint,line.length,0,0]);
    for (let j=0; j<line.length; j++) {
      const point = line[j];
      pointsData.push([point.x,point.y,point.z,point.density]);
    }
    nextPoint = pointsData.length;
  }
  const points = matrixFromArray(pointsData,Float32Array)
  const lines = matrixFromArray(linesData,Uint32Array)

  const customTypes = {}
  const injectionblobType = tree_class.prototype.insertDefaults('marker',{id:'17',name:'Injection blob'});
  return new tree_class(fileName,{},{},{'injection-blob':injectionblobType},{},points,lines);
}

swc_class.prototype.treeFromSWC = function(swcStr,fileName) {
  const parts = fileName.split('.')
  const ext = parts[parts.length-1].toLowerCase()
  
  let xmlDoc;
  let swcPoints;
  let header;
  if (ext === 'xwc') {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(swcStr,"text/xml");
  } else if (ext === 'jwc') {
    xmlDoc = xmlLib.fromDict(JSON.parse(swcStr));
  } else {
    header = [];
    // get SWC header, convert XML to json
    const re = /\s*# ?(.*)$/mg;
    let matches;
    while ((matches = re.exec(swcStr)) !== null) {
      header.push(matches[1])
    }
    header = header.join('\n')
    // note: swcPlus version information is not used
    if (header.match(/^\s*<swcPlus version=[\'\"][\d\.]+[\'\"]/g) || header.match(/^\s*<swcPlus/g)) {
      const parser = new DOMParser();
      xmlDoc = parser.parseFromString(header,"text/xml");
    }
  }
  let swcAttrs={}, metaData, customTypes, customProperties;
  if (xmlDoc) {
    const err = xmlDoc.getElementsByTagName("parsererror")
    if (err.length) {
      throw(Error('XML error in SWC+ header of file '+fileName+': '+err[0].innerHTML));
    }
    swcPoints = xmlLib.toDict(xmlDoc.getElementsByTagName('swcPoints')).swcPoints;
    swcAttrs = xmlLib.attributes(xmlDoc.documentElement);
    metaData = xmlLib.toDict(xmlDoc.getElementsByTagName('metaData')).metaData;
    customTypes = xmlLib.toDict(xmlDoc.getElementsByTagName('customTypes')).customTypes;
    customProperties = xmlLib.toDict(xmlDoc.getElementsByTagName('customProperties')).customProperties;
  }
  if (!metaData) {
    metaData = {};
    if (header) metaData.originalHeader = header;
  }
  if (!customTypes) customTypes = {};
  if (!customProperties) customProperties = {};
  // remove header/comments from SWC
  var result = swcStr.replace(/\s*#.*?$/mg,'');
  // remove empty lines and empty last line
  result = result.trim().replace(/^\s*$/mg,'');
  
  // store the data in memory-efficient typed arrays
  if (!swcPoints) {
    swcPoints = result.split('\n');
    for (let i=0; i<swcPoints.length; i++) {
      const row = swcPoints[i].replace(/^\s+/m,'').replace(/\s+$/m,'').split(/[\s,]+/)
      if (row.length >= 7) {
        // allow for sloppy SWC that contains integers written as floats
        swcPoints[i] = [ 
          Math.round(parseFloat(row[0])),
          Math.round(parseFloat(row[1])),
          parseFloat(row[2]),
          parseFloat(row[3]),
          parseFloat(row[4]),
          parseFloat(row[5]),
          Math.round(parseFloat(row[6]))
        ]
      }
    }
  }
  
  var pointsLines = this.parsePoints(swcPoints,fileName,true);
  return new tree_class(fileName,swcAttrs,metaData,customTypes,customProperties,pointsLines[0],pointsLines[1]);
}

swc_class.prototype.treeFromJSON = function(jsonStr,fileName) {
  const tree = JSON.parse(jsonStr);
  if (!tree) runtimeError('treeFromJSON: Could not parse json in file "'+fileName+'"');
  const points = matrixFromArray(tree.treePoints.data,Float32Array)
  const lines = matrixFromArray(tree.treeLines.data,Uint32Array)
  return new tree_class(fileName,tree.swcAttrs,tree.metaData,tree.customTypes,tree.customProperties,points,lines);  
}

function neurolucida_class() {
  this.point$ = new varMatrix_class(Float32Array,4);
  this.point$.row(0); // add dummy row
  this.line$ = new varMatrix_class(Uint32Array,5);
  this.line$.pushRow([0,0,0,0,0]);
  this.typeMap = {};
  this.customTypeId = 16;
  this.objectProperties = {};
  
  var tbgp = {} // tagname by geometry and part
  for (var k in swcPlus_schema.swcPlus.customTypes) {
    var attrs = tree_class.prototype.insertDefaults(k,{})
    if (attrs.cellPart) {
      tbgp[attrs.geometry] || (tbgp[attrs.geometry] = {})
      tbgp[attrs.geometry][attrs.cellPart] = k
    }
  }
  // special cases
  tbgp.border || (tbgp.border = {})
  tbgp.border.soma = 'somaContour'
  this.typeByGeometryAndPart = tbgp
}

/**
 * Neurolucida markers have a shape-property;
 * this defines a mapping from shape to symbol.
 * 
 * http://www.mbfbioscience.com/help/nl11/Content/Resources/IMAGES/markerstb3.png
 * 
 * "Dot", "OpenCircle", "Cross", "Plus", "OpenUpTriangle", "OpenDownTriangle", 
 * "OpenSquare", "Asterisk", "OpenDiamond", "FilledStar", "FilledCircle", 
 * "FilledUpTriangle", "FilledDownTriangle", "FilledSquare", "FilledDiamond", 
 * "OpenStar", "GunSight", "Circle1", "Circle2", "Circle3", "Circle4", "Circle5", 
 * "Circle6", "Circle7", "Circle8", "Circle9", "OpenQuadStar", "FilledQuadStar", 
 * "MalteseCross"
 * 
 * "FilledFinial", "OpenFinial", "Flower", "Flower2", "Flower3", "SnowFlake", 
 * "CircleArrow","DoubleCircle", "CircleCross", "Pinwheel", "TexacoStar", 
 * "ShadedStar", "SkiBasket", "Clock", "ThinArrow", "ThickArrow", 
 * "SquareGunSight", "TriStar", "NinjaStar", "KnightsCross", "Splat"
 * @const {map}
 *  
 */
neurolucida_class.prototype.markers = {
  "?"                 :[ 0,"&#x271C;"],
  "Dot"               :[ 1,"&#x00B7;"],
  "OpenCircle"        :[ 2,"&#x25EF;"],
  "Cross"             :[ 3,"&#x2A2F;"],
  "Plus"              :[ 4,"&#xFF0B;"],
  "OpenUpTriangle"    :[ 5,"&#x25B3;"],
  "OpenDownTriangle"  :[ 6,"&#x25BD;"],
  "OpenSquare"        :[ 7,"&#x25A1;"],
  "Asterisk"          :[ 8,"&#x205E;"],
  "OpenDiamond"       :[ 9,"&#x25C7;"],
  "FilledStar"        :[10,"&#x22C6;"],
  "FilledCircle"      :[11,"&#x2B24;"],
  "FilledUpTriangle"  :[12,"&#x25B2;"],
  "FilledDownTriangle":[13,"&#x25BC;"],
  "FilledSquare"      :[14,"&#x25A0;"],
  "FilledDiamond"     :[15,"&#x25C6;"],
  "Flower"            :[16,"&#x2741;"],
  "OpenStar"          :[17,"&#x2B50;"],
  "DoubleCircle"      :[18,"&#x2299;"],
  "Circle1"           :[19,"&#x278A;"],
  "Circle2"           :[20,"&#x278B;"],
  "Circle3"           :[21,"&#x278C;"],
  "Circle4"           :[22,"&#x278D;"],
  "Circle5"           :[23,"&#x278E;"],
  "Circle6"           :[24,"&#x278F;"],
  "Circle7"           :[25,"&#x2790;"],
  "Circle8"           :[26,"&#x2791;"],
  "Circle9"           :[27,"&#x2792;"],
  "Flower2"           :[28,"&#x273F;"],
  "SnowFlake"         :[29,"&#x2745;"],
  "OpenFinial"        :[30,"&#x2723;"],
  "FilledFinial"      :[31,"&#x2724;"],
  "MalteseCross"      :[32,"&#x2720;"],
  "FilledQuadStar"    :[33,"&#x2726;"],
  "OpenQuadStar"      :[34,"&#x2727;"],
  "Flower3"           :[35,"&#x273D;"],
  "Pinwheel"          :[36,"&#x2735;"],
  "TexacoStar"        :[37,"&#x272B;"],
  "ShadedStar"        :[38,"&#x2730;"],
  "SkiBasket"         :[39,"&#x2739;"],
  "Clock"             :[40,"&#x2742;"],
  "ThinArrow"         :[41,"&#x2192;"],
  "ThickArrow"        :[42,"&#x2794;"],
  "SquareGunSight"    :[43,"&#x2BD0;"],
  "GunSight"          :[44,"&#x2316;"],
  "TriStar"           :[45,"&#x1F7C1;"],
  "NinjaStar"         :[46,"&#x1F7C5;"],
  "KnightsCross"      :[47,"&#x16ED;"],
  "Splat"             :[48,"&#x273C;"],
  "CircleArrow"       :[49,"&#x27B2;"],
  "CircleCross"       :[50,"&#x2A02;"]
}

neurolucida_class.prototype.color2hex = {
  "aliceblue": "#f0f8ff",
  "antiquewhite": "#faebd7",
  "aqua": "#00ffff",
  "aquamarine": "#7fffd4",
  "azure": "#f0ffff",
  "beige": "#f5f5dc",
  "bisque": "#ffe4c4",
  "black": "#000000",
  "blanchedalmond": "#ffebcd",
  "blue": "#0000ff",
  "blueviolet": "#8a2be2",
  "brown": "#a52a2a",
  "burlywood": "#deb887",
  "cadetblue": "#5f9ea0",
  "chartreuse": "#7fff00",
  "chocolate": "#d2691e",
  "coral": "#ff7f50",
  "cornflowerblue": "#6495ed",
  "cornsilk": "#fff8dc",
  "crimson": "#dc143c",
  "cyan": "#00ffff",
  "darkblue": "#00008b",
  "darkcyan": "#008b8b",
  "darkgoldenrod": "#b8860b",
  "darkgray": "#a9a9a9",
  "darkgreen": "#006400",
  "darkgrey": "#a9a9a9",
  "darkkhaki": "#bdb76b",
  "darkmagenta": "#8b008b",
  "darkolivegreen": "#556b2f",
  "darkorange": "#ff8c00",
  "darkorchid": "#9932cc",
  "darkred": "#8b0000",
  "darksalmon": "#e9967a",
  "darkseagreen": "#8fbc8f",
  "darkslateblue": "#483d8b",
  "darkslategray": "#2f4f4f",
  "darkslategrey": "#2f4f4f",
  "darkturquoise": "#00ced1",
  "darkviolet": "#9400d3",
  "deeppink": "#ff1493",
  "deepskyblue": "#00bfff",
  "dimgray": "#696969",
  "dimgrey": "#696969",
  "dodgerblue": "#1e90ff",
  "firebrick": "#b22222",
  "floralwhite": "#fffaf0",
  "forestgreen": "#228b22",
  "fuchsia": "#ff00ff",
  "gainsboro": "#dcdcdc",
  "ghostwhite": "#f8f8ff",
  "gold": "#ffd700",
  "goldenrod": "#daa520",
  "gray": "#808080",
  "green": "#008000",
  "greenyellow": "#adff2f",
  "grey": "#808080",
  "honeydew": "#f0fff0",
  "hotpink": "#ff69b4",
  "indianred": "#cd5c5c",
  "indigo": "#4b0082",
  "ivory": "#fffff0",
  "khaki": "#f0e68c",
  "lavender": "#e6e6fa",
  "lavenderblush": "#fff0f5",
  "lawngreen": "#7cfc00",
  "lemonchiffon": "#fffacd",
  "lightblue": "#add8e6",
  "lightcoral": "#f08080",
  "lightcyan": "#e0ffff",
  "lightgoldenrodyellow": "#fafad2",
  "lightgray": "#d3d3d3",
  "lightgreen": "#90ee90",
  "lightgrey": "#d3d3d3",
  "lightpink": "#ffb6c1",
  "lightsalmon": "#ffa07a",
  "lightseagreen": "#20b2aa",
  "lightskyblue": "#87cefa",
  "lightslategray": "#778899",
  "lightslategrey": "#778899",
  "lightsteelblue": "#b0c4de",
  "lightyellow": "#ffffe0",
  "lime": "#00ff00",
  "limegreen": "#32cd32",
  "linen": "#faf0e6",
  "magenta": "#ff00ff",
  "maroon": "#800000",
  "mediumaquamarine": "#66cdaa",
  "mediumblue": "#0000cd",
  "mediumorchid": "#ba55d3",
  "mediumpurple": "#9370db",
  "mediumseagreen": "#3cb371",
  "mediumslateblue": "#7b68ee",
  "mediumspringgreen": "#00fa9a",
  "mediumturquoise": "#48d1cc",
  "mediumvioletred": "#c71585",
  "midnightblue": "#191970",
  "mintcream": "#f5fffa",
  "mistyrose": "#ffe4e1",
  "moccasin": "#ffe4b5",
  "navajowhite": "#ffdead",
  "navy": "#000080",
  "oldlace": "#fdf5e6",
  "olive": "#808000",
  "olivedrab": "#6b8e23",
  "orange": "#ffa500",
  "orangered": "#ff4500",
  "orchid": "#da70d6",
  "palegoldenrod": "#eee8aa",
  "palegreen": "#98fb98",
  "paleturquoise": "#afeeee",
  "palevioletred": "#db7093",
  "papayawhip": "#ffefd5",
  "peachpuff": "#ffdab9",
  "peru": "#cd853f",
  "pink": "#ffc0cb",
  "plum": "#dda0dd",
  "powderblue": "#b0e0e6",
  "purple": "#800080",
  "rebeccapurple": "#663399",
  "red": "#ff0000",
  "rosybrown": "#bc8f8f",
  "royalblue": "#4169e1",
  "saddlebrown": "#8b4513",
  "salmon": "#fa8072",
  "sandybrown": "#f4a460",
  "seagreen": "#2e8b57",
  "seashell": "#fff5ee",
  "sienna": "#a0522d",
  "silver": "#c0c0c0",
  "skyblue": "#87ceeb",
  "slateblue": "#6a5acd",
  "slategray": "#708090",
  "slategrey": "#708090",
  "snow": "#fffafa",
  "springgreen": "#00ff7f",
  "steelblue": "#4682b4",
  "tan": "#d2b48c",
  "teal": "#008080",
  "thistle": "#d8bfd8",
  "tomato": "#ff6347",
  "turquoise": "#40e0d0",
  "violet": "#ee82ee",
  "wheat": "#f5deb3",
  "white": "#ffffff",
  "whitesmoke": "#f5f5f5",
  "yellow": "#ffff00",
  "yellowgreen": "#9acd32",
  "darkyellow":"#808000" // from here on: colors not in html standard
}

neurolucida_class.prototype.tag2geom = {
  "tree":"tree",
  "marker":"marker",
  "text":"marker",
  "property":"property",
  "spine":"marker",
  "image":"image"
}

neurolucida_class.prototype.lc2part = {
  "cellbody":"soma",
  "soma":"soma",
  "axon":"axon",
  "dendrite":"dendrite",
  "apical":"apical dendrite",
  "spine":"spine",
}

neurolucida_class.prototype.matchGeometry = function(tag,attrs) {
  var geom = this.tag2geom[tag]
  if (tag == 'contour') geom = attrs.closed ? 'contour' : 'border'
  return geom
}

neurolucida_class.prototype.matchPart = function(tag,attrs) {
  var part = attrs.cellPart || attrs.name || tag
  if (!part) return
  return (
    (this.lc2part[part.toLowerCase()]) || 
    (part.match(/soma|cell\s*body/i) && 'soma')
  )
}

neurolucida_class.prototype.matchType = function(tag,attrs) {
  let swcType;
  const geom = this.matchGeometry(tag,attrs);
  if (geom) {
    const typeByPart = this.typeByGeometryAndPart[geom];
    if (typeByPart) {
      var part = this.matchPart(tag,attrs);
      swcType = part && typeByPart[part.toLowerCase()];
    }
    swcType = swcType || geom;
  }
  return swcType || 'unknown';
}

// store attributes as custom object/point properties
neurolucida_class.prototype.setObjectProperties = function(pointId,props) {
  const P = this.objectProperties;
  if (Object.keys(props).length) {
    var allProps = P[pointId];
    if (allProps) for (var k in props) allProps[k] = props[k];
    else P[pointId] = props;
  }
}

neurolucida_class.prototype.createType = function(swcType,attrs) {
  let typeId;
  const spec = swcTypeSpec(swcType);
  if (spec) {
    const swcAttrs = {}
    for (let k in attrs) {
      const k_lc = k.toLowerCase();
      if (spec[k_lc]) {
        const defVal = spec[k_lc][0]; // default value
        if (defVal !== null && defVal === attrs[k]) {
          // remove attributes that are equal to the default value
          delete attrs[k];
        } else {
          const valType = spec[k_lc][1]; // value-type
          if (valType) {
            // only attributes that have a value-type are part of the 
            // custom swc-type, all others are stored as object-properties
            swcAttrs[k_lc] = attrs[k];
            delete attrs[k];
          }
        }
      }
    }
    const typeKey = JSON.stringify([swcType,swcAttrs]);
    typeId = this.typeMap[typeKey];
    if (!typeId) typeId = spec['id'][0];
    if (!typeId) {
      // new custom type, custom id
      typeId = this.customTypeId;
      this.customTypeId += 1;
    }
    this.typeMap[typeKey] = typeId;
  }
  return typeId
}

neurolucida_class.prototype.pushLine = function(line,attrs) {
  // line[1] points to first point and equals objectId
  if (attrs) this.setObjectProperties(line[1],attrs)  
  return this.line$.pushRow(line)
}

neurolucida_class.prototype.getCustomTypes = function() {
  var customTypes = {}
  for (var k in this.typeMap) {
    var tp = JSON.parse(k)
    tp[1].id = this.typeMap[k]
    if (!customTypes.hasOwnProperty(tp[0])) customTypes[tp[0]] = []
    customTypes[tp[0]].push(tp[1])   
  }
  for (var k in customTypes) {
    // if only one custom types of a given class exists, remove the class layer
    if (customTypes[k].length == 1) customTypes[k] = customTypes[k][0]
  }
  return customTypes
}

neurolucida_class.prototype.getCustomProperties = function() {
  return tree_class.compressProperties(this.objectProperties);
}

neurolucida_class.prototype.addBranchFromXML = function(xmlElem,parentLineId,negOffset) {
  if (xmlElem.tagName === 'images') {
    const x2j = [
      { xpath:'*', type:'dict' },
      { xpath:'images', type:'list' },
      { xpath:'filename', type:'string' },
      { xpath:'channel', keyFrom:'id' }
    ];
    const imageCoords = xmlLib.toJ(xmlElem,x2j);
    this.setImageCoords('XML',imageCoords.images);
    return;
  }
  if (xmlElem.tagName === 'filefacts') {
    const sections = [];
    const childNodes = xmlElem.childNodes;
    for (let i=0; i<xmlElem.childNodes.length; i++) {
      const ch = childNodes[i];
      if (ch.tagName === 'section') {
        const section = {};
        for (let i=0; i<ch.attributes.length; i++) {
          const attr = ch.attributes[i];
          section[attr.name] = attr.value;
        }
        sections.push(section);
      }
    }
    this.objectProperties[0] = this.objectProperties[0] || {}
    this.objectProperties[0]['sections'] = sections;
    return;
  }
  
    
  const firstPoint = this.point$.nR;
  const childNodes = xmlElem.childNodes;
  const children = [];
  const unparsed = xmlLib.attributes(xmlElem);
  const attrs = {};
  for (let k in unparsed) this.setAttribute(attrs, k,unparsed[k]);

  for (let i=0; i<childNodes.length; i++) {
    const ch = childNodes[i];
    const tag = ch.tagName;
    if (!tag) continue;
    if (tag === 'property') {     
      const key = ch.getAttribute('name');
      const fc = ch.firstChild;
      if (fc && fc.tagName) this.setAttribute(attrs,key,fc.firstChild ? fc.firstChild.nodeValue : '',fc.tagName);
    } else if (tag === 'point') {
      this.point$.pushRow([
        ch.getAttribute('x'),
        ch.getAttribute('y'),
        ch.getAttribute('z'),
        0.5*ch.getAttribute('d') // SWC stores radius, not diameter
      ])
      const sid = ch.getAttribute('sid');
      if (sid)  this.setAttribute(attrs,'sectionId',sid);
    } else if (['spine','marker','branch'].indexOf(tag) > -1) {
      const offset = this.point$.nR-firstPoint;
      children.push([ch,offset]);
    } else if (tag === 'resolution') {
      this.setAttribute(attrs,'resolution',ch.firstChild.nodeValue);
    } else if (tag === 'value') {
      this.setAttribute(attrs,'value',ch.firstChild.nodeValue);
    } else if (tag === 'font') {
      const font = {
        name: ch.getAttribute('name'),
        size: ch.getAttribute('size')
      }
      this.setAttribute(attrs,'font',font);
    } else {
      console.log('Neurolucida XML: unsupported xml tag "'+tag+'".')
    }
  }
  let typeId;
  if (xmlElem.tagName == 'branch') {
    // inherit type
    const parentLine = this.line$.row(parentLineId)
    typeId = parentLine[0]
  } else if (xmlElem.tagName == 'marker') {
    this.setAttribute(attrs,'symbolName',attrs.type); delete attrs.type;
    const marker = this.markers[attrs.symbolName];
    if (marker) {
      this.setAttribute(attrs, 'markerid', marker[0]);
      this.setAttribute(attrs, 'symbol', marker[1]);
    }
    const swcType = this.matchType(xmlElem.tagName,attrs)
    typeId = this.createType(swcType,attrs)
  } else {
    if (attrs.type) { 
      this.setAttribute(attrs, 'cellPart', attrs.type);
      delete attrs.type
    }
    const swcType = this.matchType(xmlElem.tagName,attrs);
    typeId = this.createType(swcType,attrs);
  }
  if (typeId !== undefined) {
    parentLineId = this.pushLine([
      typeId,
      firstPoint,
      this.point$.nR-firstPoint,
      parentLineId,
      negOffset
    ],attrs)
    const parentLine = this.line$.row(parentLineId);
    for (let i=0; i<children.length; i++) {
      const child = children[i];
      this.addBranchFromXML(child[0],parentLineId,parentLine[2]-child[1]);
    }
  }
}

neurolucida_class.prototype.treeFromXML = function(xmlStr,fileName) {
  xmlStr = xmlStr.replace('xmlns="http://www.mbfbioscience.com/2007/neurolucida"','');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlStr,"text/xml");
  const rootObjects = ['filefacts','images','contour','tree','marker','text'];
  
  for (let t=0; t<rootObjects.length; t++) {
    const tag = rootObjects[t];
    var objElems = xmlLib.xPath(xmlDoc,'/mbf/'+tag);
    var elemCounter = 0;
    var objElem = objElems.iterateNext ? objElems.iterateNext() : objElems[elemCounter];
    while (objElem) {
      this.addBranchFromXML(objElem,0,0)
      elemCounter += 1
      objElem = objElems.iterateNext ? objElems.iterateNext() : objElems[elemCounter];
    }
  }
  const customProperties = tree_class.compressProperties(this.objectProperties);
  return new tree_class(fileName,{},{},this.getCustomTypes(),customProperties,this.point$.toMatrix(),this.line$.toMatrix());
}

/**
 * From http://www.mbfbioscience.com/help/nx11/Content/Analyses/Dendrogram_Analysis.htm
 * 
 * Normal Ending (N) Default
 * High Ending (H)   Ending located at the top of the current section.
 * Low Ending (L)    Ending located at the bottom of the current section.
 * Incomplete (I)    Use to label arbitrary endings, endings that disappear for unknown reasons, endings that should be audited later.
 * Origin Ending (O) Indicates the directionality of the tree.
 * Midpoint (M)      Ending of a long branch that is indeterminate at the time it is placed.
 */
// NOT USED YET, TO BE VERIFIED
neurolucida_class.prototype.leafTypes = {
  1: "high",
  2: "low",
  3: "midpoint",
  4: "?incomplete",
  5: "?origin",
  6: "generated",
  7: "normal"
}

neurolucida_class.prototype.hex2 = function(x) {
  return (x>15 ? '' : '0')+x.toString(16)
}

neurolucida_class.prototype.rgbtriplet2hex = function(s) {
  const match = s.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  return match ? '#'+parseInt(match[1]).toString(16)+parseInt(match[2]).toString(16)+parseInt(match[3]).toString(16) : s;
}

neurolucida_class.prototype.setAttribute = function(attrs,key,value) {
  const key_lc = key.toLowerCase();
  if (key_lc === 'color') {
    attrs.color = value[0] === '#' ? value.toLowerCase() : (value.substr(0,3)==='RGB' ? this.rgbtriplet2hex(value.toLowerCase()) : (this.color2hex[value.toLowerCase()] || value));
  } else if (key_lc === 'resolution') {
    attrs.resolution = typeof value === 'string' ? parseFloat(value) : value;
  } else if (key_lc === 'imagecoords') {
    attrs.imageCoords = value;
  } else if (key_lc === 'closed') {
    attrs.closed = typeof value === 'string' ? JSON.parse(value) : value;
  } else if (key_lc === 'filldensity') {
    attrs.fillDensity = typeof value === 'string' ? parseFloat(value) : value;
  } else if (key_lc === 'guid' || key_lc === 'mbfobjecttype') {
    // do nothing
  } else {
    attrs[key] = value;
  }
}

neurolucida_class.prototype.rgbFromDAT = function($bytes) {
  return '#'+this.hex2($bytes.readUint8())+this.hex2($bytes.readUint8())+this.hex2($bytes.readUint8())
}

neurolucida_class.prototype.stringFromDAT = function($bytes) {
  $bytes.pos += 2;
  const maxPos = $bytes.pos-2+$bytes.readUint32();
  let s = '';
  for (var i=$bytes.pos; i<maxPos; i++) s += String.fromCharCode($bytes.readUint8());
  return s
}

neurolucida_class.prototype.descriptionFromDAT = function($bytes) {
  $bytes.pos += $bytes.peekUint32(2);
}

neurolucida_class.prototype.sampleFromDAT = function($bytes) {
  $bytes.pos += 2; // skip type
  const nextPos = $bytes.pos-2+$bytes.readUint32();
  const sample = new Float32Array(4);
  sample[0] = $bytes.readFloat32()
  sample[1] = $bytes.readFloat32()
  sample[2] = $bytes.readFloat32()
  sample[3] = 0.5*$bytes.readFloat32() // use radius instead of diameter
  if ($bytes.pos < nextPos) $bytes.readUint16(); // section number, ignore
  if ($bytes.pos < nextPos) console.log('Neurolucida DAT: Bytes left after reading sample');
  return sample;
}

neurolucida_class.prototype.samplelistFromDAT = function($bytes) {
  $bytes.pos += 2; // skip type
  const sz = $bytes.readUint32();
  const nextPos = $bytes.pos+sz-6;
  const len0 = $bytes.readUint16();
  const firstPoint = this.point$.nR;
  while ($bytes.pos<nextPos) {
    $bytes.assertType('sample',true);
    this.point$.pushRow( this.sampleFromDAT($bytes) );
  }
  var len = this.point$.nR-firstPoint // length
  if (len !== len0) console.log('Neurolucida DAT: expected '+len0+' samples, but got '+len);
  return [firstPoint,len];
}

neurolucida_class.prototype.propertyFromDAT = function($bytes) {
  $bytes.readUint16(); // type
  const sz = $bytes.readUint32();
  const maxPos = $bytes.pos+sz-6;
  $bytes.assertType('string',true);
  const key = this.stringFromDAT($bytes);
  let val = true;
  const numValues = $bytes.readUint16();
  if (numValues) {
    const values = []
    while ($bytes.pos<maxPos) {
      let dataType = $bytes.readUint16();
      if (dataType == 0) {
        values.push( $bytes.readFloat32() );
      } else if (dataType == 1) {
        values.push( this.stringFromDAT($bytes) );
      } else if (dataType == 2) {
        values.push( this.stringFromDAT($bytes) );
      } else if (dataType == 3) { // RGBA?
        values.push( this.rgbFromDAT($bytes) ); $bytes.readUint8(); // ignore transparency
      } else {
        console.log('Unknown dataType in propertyFromDAT: '+dataType);
      }
    }
    val = values.length > 1 ? values : values[0];
  }
  if ($bytes.pos != maxPos) {
    console.log('Neurolucida DAT: Not all bytes read from property '+key+' with value '+val) 
    $bytes.pos = maxPos;
  }
  return [key,val];
}

neurolucida_class.prototype.propertyListFromDAT = function($bytes) {
  $bytes.pos += 2; // skip type
  const nextPos = $bytes.pos-2+$bytes.readUint32();
  const len = $bytes.readUint16();
  let numProps = 0;
  const props = {};
  while ($bytes.pos<nextPos) {
    if (!$bytes.assertType('property')) {
      console.warn('Neurolucida DAT: invalid property');
      break
    }
    const [k,v] = this.propertyFromDAT($bytes);
    this.setAttribute(props, k,v);
    numProps += 1;
  }
  if (numProps !== len) {
    console.log('Neurolucida DAT: Property list with declared length '+len+' has '+numProps+' items.',props) ;
  }
  return props;
}

neurolucida_class.prototype.thumbnailFromDAT = function($bytes) {
  //const numCols = $bytes.readUint16();
  //const numRows = $bytes.readUint16();
  console.log('Neurolucida.DAT: ignoring thumbnail');
  $bytes.pos += $bytes.peekUint32(2);
}

/**
 * Loads a contour-block from binary Neurolucida data `bytes`, starting at position `pos`.
 * Contour contains
 * - 2 byte `closed` attribute
 * - 3x 1 byte `color` attribute (R,G,B)
 * - 3 unknown bytes
 * - property list (more attributes)
 * - sample list (appended to the line$ matrix)
 */
neurolucida_class.prototype.readContourFromDAT = function($bytes,maxPos, parentLineId) {
  $bytes.assertType('string',true);
  const name = this.stringFromDAT($bytes);
  const attrs = { };
  this.setAttribute(attrs, 'name', name);
  this.setAttribute(attrs, 'closed', $bytes.readUint16() == 1);
  this.setAttribute(attrs, 'color', this.rgbFromDAT($bytes));
  this.setAttribute(attrs, 'alpha', $bytes.readUint8());
  let unknown;
  unknown = $bytes.readUint16(); if (unknown) console.log('Neurolucida DAT: not zero!',unknown);
  this.setAttribute(attrs, 'unknown', unknown);
  if ($bytes.assertType('propertyList')) {
    Object.assign( attrs, this.propertyListFromDAT($bytes) );
    if (attrs.type) { 
      this.setAttribute(attrs, 'cellPart', attrs.type);
      delete attrs.type;
    };
  }
  var swcType = this.matchType('contour',attrs);
  var typeId = this.createType(swcType,attrs);
  var samples = this.samplelistFromDAT($bytes);

  let extraBytes = 0;
  if ($bytes.assertType('markerList')) {
    $bytes.pos += 2;
    const nextPos = $bytes.pos-2+$bytes.readUint32();
    const len = $bytes.readUint16();
    if (len) extraBytes = this.readBlocksFromDAT($bytes,nextPos, parentLineId,len);
  }
  
  this.pushLine([typeId,samples[0],samples[1],parentLineId,0],attrs);
  return extraBytes;
}

neurolucida_class.prototype.readTextFromDAT = function($bytes,maxPos, parentLineId) {
  $bytes.assertType('string',true);
  const text = this.stringFromDAT($bytes);
  const attrs = {}
  this.setAttribute(attrs, 'text',text);
  this.setAttribute(attrs, 'color',this.rgbFromDAT($bytes));
  let unknown; 
  unknown = $bytes.readUint8(); if (unknown) console.log('Neurolucida DAT: not zero!',unknown);
  this.setAttribute(attrs, 'unknown', unknown);
  $bytes.assertType('sample',true);
  const firstPoint = this.point$.nR;
  this.point$.pushRow( this.sampleFromDAT($bytes) );
  unknown = $bytes.readUint16(); if (unknown) console.log('Neurolucida DAT: not zero!',unknown);
  if ($bytes.assertType('propertyList')) {
    Object.assign( attrs, this.propertyListFromDAT($bytes) );
  }
  const swcType = this.matchType('marker',attrs);
  const typeId = this.createType(swcType,attrs);
  if ($bytes.pos < maxPos) $bytes.pos = maxPos;

  this.pushLine([typeId,firstPoint,1,parentLineId,0],attrs);
}

neurolucida_class.prototype.readMarkerFromDAT = function($bytes,maxPos, parentLineId) {
  // NOTE: The size of this block is larger than the declared size of its container. Neurolucida bug?
  //       The size difference is the length of the symbol name.
  const attrs = {};
  this.setAttribute(attrs, 'symbolName',this.stringFromDAT($bytes));
  const marker = this.markers[attrs.symbolName];
  if (marker) {
    this.setAttribute(attrs, 'markerId', marker[0]);
    this.setAttribute(attrs, 'symbol', marker[1]);
  }
  this.setAttribute(attrs, 'color',this.rgbFromDAT($bytes));
  this.setAttribute(attrs, 'alpha',$bytes.readUint8());
  if ($bytes.assertType('propertyList')) Object.assign( attrs, this.propertyListFromDAT($bytes) );
  $bytes.assertType('sampleList',true);
  const samples = this.samplelistFromDAT($bytes);
  
  const swcType = this.matchType('marker',attrs);
  const typeId = this.createType(swcType,attrs);
  this.pushLine([typeId,samples[0],samples[1],parentLineId,0],attrs);
  return $bytes.pos-maxPos;
}

neurolucida_class.prototype.readSpineFromDAT = function($bytes,maxPos, parentLineId) {
  const rgb = this.rgbFromDAT($bytes);
  $bytes.readUint8(); // ignore transparency
  const unknown = $bytes.readUint16();
  if (unknown !== 1) console.log('Neurolucida DAT: expected value "1" but got '+unknown);
  const attrs = { part: 'spine' };
  if ($bytes.assertType('propertyList')) {
    Object.assign( attrs, this.propertyListFromDAT($bytes) );
  }
  const parentOffset = $bytes.readUint16();
  
  var firstPoint = this.point$.nR;
  while ( $bytes.assertType('sample') ) {
    this.point$.pushRow( this.sampleFromDAT($bytes) );
  }
  if ($bytes.pos != maxPos) {
    console.log('Neurolucida DAT: '+(maxPos-$bytes.pos)+' leftover bytes while reading spine.');
    $bytes.pos = maxPos;
  }
  var len = this.point$.nR-firstPoint // length
  const swcType = this.matchType('spine',attrs)
  const typeId = this.createType(swcType,attrs)
  const parentLine = this.line$.row(parentLineId);
  const negOffset = parentLine[2]-parentOffset;
  this.pushLine([typeId,firstPoint,len,parentLineId,negOffset],attrs);
}

neurolucida_class.prototype.readBranchFromDAT = function($bytes,maxPos, parentLineId) {
  const attrs = {};
  const leafCode = $bytes.readUint16();
  const leaf = this.leafTypes[leafCode];
  if (leaf) this.setAttribute(attrs, 'leaf',leaf);
  // silently ignore numBranches, it is inferred from the file structure  
  const numBranches = $bytes.readUint16();

  // branch may start with attributes
  if ($bytes.assertType('propertyList')) {
    Object.assign( attrs, this.propertyListFromDAT($bytes) );
  }
  
  // get samples
  let lineId;
  if ($bytes.assertType('sampleList')) {
    const parentLine = this.line$.row(parentLineId);
    const samples = this.samplelistFromDAT($bytes);
    if (parentLineId === 0) console.log('WARNING: parent line of object '+this.line$.nR+' has id zero');
    if (parentLine[3] === 0 && parentLine[2] === 1 && parentLine[1]+1 === samples[0]) {
      // the parent line is a new tree with an initial sample
      parentLine[2] += samples[1]; // extend the parent line with these samples
      lineId = parentLineId
    } else {
      // add line to the branch
      lineId = this.pushLine([parentLine[0],samples[0],samples[1],parentLineId],attrs);
    }
    // attach attributes to line
    if (Object.keys(attrs).length) {
      const line = this.line$.row(lineId);
      this.setObjectProperties(line[1],attrs);
    }
  }
  
  // get branches
  return this.readBlocksFromDAT($bytes,maxPos,lineId || parentLineId);
}

neurolucida_class.prototype.readSubtreeFromDAT = function($bytes,maxPos, parentLineId) {
  // Branch that is part of a 'Set', treat as regular branch
  return this.readBranchFromDAT($bytes,maxPos, parentLineId);
}

neurolucida_class.prototype.read0x0210FromDAT = function($bytes,maxPos, parentLineId) {
  // NAG in Neurolucida DAT: 0x0210 seems to have no purpose and reports length 2 bytes too low
  $bytes.pos = maxPos;  
  let unknown;
  unknown = $bytes.readUint16(); if (unknown) console.log('Neurolucida DAT: not zero!',unknown);
  return 2; // extraBytes
}

neurolucida_class.prototype.readScalebarFromDAT = function($bytes,maxPos, parentLineId) {
  console.log('Neurolucida DAT: ignoring Scalebar.');
  $bytes.pos = maxPos;
}

neurolucida_class.prototype.readTreeFromDAT = function($bytes,maxPos,parentLineId) {
  // get attributes
  const attrs = {};
  const partId = $bytes.readUint16();
  if (partId == 0) this.setAttribute(attrs, 'cellPart','axon');
  else if (partId == 1) this.setAttribute(attrs, 'cellPart','dendrite');
  else if (partId == 2) this.setAttribute(attrs, 'cellPart','apical');
  this.setAttribute(attrs, 'color',this.rgbFromDAT($bytes));
  let unknown;
  unknown = $bytes.readUint8(); if (unknown !== 0) console.log('Neurolucida DAT: not zero!');
  unknown = $bytes.readUint8(); if (unknown !== 0) console.log('Neurolucida DAT: not zero!');
  unknown = $bytes.readUint8(); if (unknown !== 0) console.log('Neurolucida DAT: not zero!');
  if ($bytes.assertType('propertyList')) {
    Object.assign( attrs, this.propertyListFromDAT($bytes) );
  }
  // get initial sample
  const swcType = this.matchType('tree',attrs);
  const typeId = this.createType(swcType,attrs);
  let lineId;
  if ($bytes.assertType('sample')) {
    const firstPoint = this.point$.nR;
    this.point$.pushRow( this.sampleFromDAT($bytes) );
    lineId = this.pushLine( [typeId,firstPoint,1,parentLineId,0],attrs ); // new line becomes parent
  } else {
    throw(Error('Neurolucida DAT: Tree without initial sample.'));
  }
  
  // get branches
  return this.readBlocksFromDAT($bytes,maxPos,lineId || parentLineId);
}

/**
 * Load blocks from binary Neurolucida data `$bytes`, starting at position `$bytes.pos` and not exceeding maxPos.
 * Block may contain sub-blocks.
 */
neurolucida_class.prototype.readBlocksFromDAT = function($bytes,maxPos, parentLineId,numBlocks) {
  const maxIter = 100000; // to prevent infinite loops
  let nIter = 0;
  let endPos = $bytes.data.byteLength-4;
  let sumExtraBytes = 0;
  let blockTypes = [];
  while (($bytes.pos<endPos && $bytes.pos<maxPos-4+sumExtraBytes) || (numBlocks && blockTypes.length<numBlocks)) {
    nIter += 1;
    if (nIter>maxIter) throw(Error('Neurolucida DAT: Too many iterations while reading data blocks.'));
    const tp = $bytes.peekUint16(0); // type
    let nextPos = $bytes.pos+$bytes.peekUint32(2);
    const type = $bytes.nrlcdTypes[tp] || 'unknown';
    blockTypes.push(type);
    const fun = type+'FromDAT';
    const readFun = 'read'+fun[0].toUpperCase()+fun.substr(1);
    let knownExtraBytes = 0;
    if (this[readFun]) {
      $bytes.pos += 6; // type and size
      knownExtraBytes = this[readFun]($bytes,nextPos, parentLineId) || 0;
      sumExtraBytes += knownExtraBytes;
    } else if (this[fun]) {
      this[fun]($bytes);
    } else if (type.substr(-4) == 'List') {
      $bytes.pos += 6; // type and size
      const len = $bytes.readUint16();
      if (len) {
        knownExtraBytes = this.readBlocksFromDAT($bytes,nextPos, parentLineId,len);   
        sumExtraBytes += knownExtraBytes;
      }
    } else {
      console.log('Neurolucida DAT: No reader for block of type "'+type+'" ('+tp+'). Report to hbp@scalablebrainatlas.org.');
      $bytes.pos = nextPos; // skip remainder of the block
    }
    if ($bytes.peekUint32(0) === 0xAABBCCDD) break; // Neurolucida Explorer may store additional data after this boundary.
    const extraBytes = $bytes.pos - nextPos;
    if (extraBytes !== knownExtraBytes) {
      console.log('Neurolucida DAT: Data block of type "'+type+'" has '+extraBytes+' extra bytes, expected '+knownExtraBytes+'.');
    }
  }
  const extraBytes = $bytes.pos - maxPos;
  if (extraBytes !== sumExtraBytes && $bytes.pos < endPos) {
    const parentLine = this.line$.row(parentLineId);
    const firstPoint = this.point$.row(parentLine[1]);
    const lastPoint = this.point$.row(parentLine[1]+parentLine[2]-1);
    console.log('Neurolucida DAT: List of blocks has '+extraBytes+' extra bytes, expected '+sumExtraBytes+'.','The '+blockTypes.length+' block-types are: '+blockTypes,'The parent object '+parentLine+' has first point '+firstPoint+' and last point '+lastPoint);
    //if ($bytes.pos < maxPos) $bytes.pos = maxPos;
  }
  return $bytes.pos - maxPos;
}


neurolucida_class.prototype.setImageCoords = function(format,imageCoords,attrs) {
  const sectionImages = [];
  if (format === 'DAT' || format === 'ASC') {
    // DAT or ASC source
    let img;
    for (let i=0; i<imageCoords.length; i++) {
      const v = imageCoords[i];
      if (v === 'Filename') {
        img = { 'filename': imageCoords[i+1] }
        sectionImages.push(img);
        i += 1;
      } else if (v === 'Merge') {
        img.merge = imageCoords.slice(i+1,i+5);
        i += 3;
      } else if (v === 'Coords') {
        img.scale = imageCoords.slice(i+1,i+3); 
        img.coord = imageCoords.slice(i+3,i+6); 
        i += 4;
      }
    }
  } else {
    // XML source
    for (let i=0; i<imageCoords.length; i++) {
      let img = imageCoords[i];
      img.scale = [img.scale.x,img.scale.y];
      img.coord = [img.coord.x,img.coord.y,img.coord.z];
      sectionImages.push(img);
    }
  }
  for (let i=0; i<sectionImages.length; i++) {
    const img = sectionImages[i];
    if (img.filename) {
      const full = img.filename || '';
      const parts = full.split(/[\\\/]/);
      img.filename = parts.join('/');
      img.name = parts[parts.length-1];
    }
    if (img.scale) img.scale = img.scale.map(parseFloat);
    if (img.coord) img.coord = img.coord.map(parseFloat);
    if (img.merge) img.merge = img.merge.map(parseFloat);
    const firstPoint = this.point$.nR;
    const sample = sectionImages[i].coord;
    this.point$.pushRow( [sample[0],sample[1],sample[2],0] );
    const swcType = this.matchType('image',attrs);
    const typeId = this.createType(swcType,attrs);
    this.pushLine( [typeId,firstPoint,1,0,0],img );
  }
}

neurolucida_class.prototype.treeFromDAT = function(arrayBuf,fileName) {
  let bytes = new DataView(arrayBuf);
  const head = new Uint8Array(arrayBuf,0,70);
  const token = 'V3 DAT file';
  for (let i=0; i<token.length; i++) {
    if (token.charCodeAt(i) != head[i+1]) {
      throw(Error('File does not have a valid Neurolucida V3 DAT header'));
    }
  }
  const $bytes = new bytes_class(bytes,70);
  const attrs = {};
  if ($bytes.assertType('description')) {
    this.setAttribute(attrs, 'description', this.descriptionFromDAT($bytes));
  }
  while ($bytes.assertType('propertyList')) {
    Object.assign( attrs, this.propertyListFromDAT($bytes) );
  }
  if (attrs.imageCoords) {
    this.setImageCoords('DAT',attrs.imageCoords,attrs);
  }
  if (Object.keys(attrs).length) this.setObjectProperties(0,attrs);
  this.readBlocksFromDAT($bytes,bytes.byteLength-4,0);
  const customProperties = tree_class.compressProperties(this.objectProperties);
  return new tree_class(fileName,{},{},this.getCustomTypes(),customProperties,this.point$.toMatrix(),this.line$.toMatrix())
}

neurolucida_class.prototype.jsonEncode = function(s) {
  var parts = s.split(/\s+/)
  if (parts.length > 1) {
    try {
      return JSON.stringify( parts.map(JSON.parse) )
    } catch(e) {
    }
  }
  return JSON.stringify(s)
}

neurolucida_class.prototype.jsonFromASC = function(ascStr) {
  let json = ascStr;
  // encode quoted words
  json = json.replace(/"((?:[^"\\]|\\[^"])*)"/mg, ($0,$1) => { return '"$'+btoa($1)+'$"' });
  // remove single line comments
  json = json.replace(/\s*;.*?$/mg,'');
  // replace | forks
  json = json.replace(/\)(\s*)\|(\s*)\(/g,')$1][$2(');
  json = json.replace(/\)(>?\s*)(["\w]+)(\s*)\|(\s*)\(/g,')$1["@attr","leaf","$2"]$3][$4(');
  json = json.replace(/\)(>?\s*)(["\w]+)(\s*)\)/g,')$1["@attr","leaf","$2"]$3)');
  // spines
  json = json.replace(/\<([^\<]+)\>/g,'["@spine",\n$1]');
  // x y z d quadruplets
  json = json.replace(/\(\s*([-.\d]+)\s*([-.\d]+)\s*([-.\d]+)\s*([-.\d]+)\s*\)/mg,'[$1,$2,$3,$4],');
  // x y z d + section quintuplets
  json = json.replace(/\(\s*([-.\d]+)\s*([-.\d]+)\s*([-.\d]+)\s*([-.\d]+)\s*S(\d+)\s*\)/mg,'[$1,$2,$3,$4,$5],');
  // contour names and markers
  json = json.replace(/\("([^"]*)"/mg,'["@contour","$1",') // quoted string
  json = json.replace(/\((\w+)(\s*)\(/mg,'["@marker","$1",$2(');
  // attributes
  // . key-only (may cover multiple lines)
  json = json.replace(/\(\s*(\w[^\s\)]*)\s*\)\s*(?=\n)/mg,'["@attr","$1"],');
  // . key-string pair (may cover multiple lines)
  json = json.replace(/\(\s*(\w[^\s]*)\s+"([^"]*)"\)\s*(?=\n)/g,function($0,$1,$2) { return '\n["@attr","'+$1+'",'+JSON.stringify($2)+'],' });
  // . key-value pair (single line, value may contain brackets) [better but slower: use neurolucida_class.prototype.jsonEncode()]
  json = json.replace(/\(\s*(\w[^\s]*)\s+([^\s].*?)\s*\)\s*$/mg,function($0,$1,$2) { return '["@attr","'+$1+'",'+JSON.stringify($2)+'],' });
  // . key-value pair (may cover multiple lines, value with no brackets) [better but slower: use neurolucida_class.prototype.jsonEncode()]
  json = json.replace(/\(\s*(\w[^\s]*)\s+([^\s\(\)][^\(\)]*?)\s*\)\s*(?=\n)/g,function($0,$1,$2) { return '\n["@attr","'+$1+'",'+JSON.stringify($2)+'],' });
  // replace round by square brackets
  json = json.replace(/^(\s*)\(/mg,'$1[');
  json = json.replace(/\)(\s*)$/mg,']$1');
  // remove excess commas
  json = json.replace(/\],(\s*)\]/g,']$1]');
  // add missing commas
  json = json.replace(/\](\s*)\[/g,'],$1[');
  // decode quoted words
  json = json.replace(/"\$([^"]*)\$"/mg,function($0,$1) { return JSON.stringify(atob($1)) });
  json = json.replace(/\\"\$([^"]*)\$\\"/mg,function($0,$1) { return '\\'+JSON.stringify(atob($1)).slice(0,-1)+'\\\"' });
  return '['+json+']';
}

neurolucida_class.prototype.addBranchFromASC = function(data, parentLineId,negOffset) {
  const children = [];
  const attrs = {};
  const data0 = data[0];
  let tag;
  let i = 0;
  if (data0 === '@marker') {
    tag = 'marker';
    this.setAttribute(attrs, 'symbolName', data[1]);
    const marker = this.markers[attrs.symbolName];
    if (marker) {
      this.setAttribute(attrs, 'markerId', marker[0]);
      this.setAttribute(attrs, 'symbol', marker[1]);
    }
    i=2;
  } else if (data0 === '@spine') {
    tag = 'spine';
    i=1;
  } else if (data0 === '@contour') {
    tag = 'contour';
    this.setAttribute(attrs, 'name', data[1]);
    i=2;
  }
  let branchPoint;
  for (; i<data.length; i++) {
    var v = data[i];
    if (!v.length) continue
    if (typeof v == 'string') {
      tag = 'marker'
      this.setAttribute(attrs, 'name', v);
      continue
      //throw 'Neurlucida ASC: expecting array, not string "'+v+'"'
    }
    var v0 = v[0];
    var tov0 = typeof v0;
    if (v0 === '@attr') {
      const key = String(v[1]);
      const key_lc = key.toLowerCase();
      if (v.length === 2) {
        // see whether single unquoted string represents part
        const part = this.lc2part[key.toLowerCase()]
        if (part) this.setAttribute(attrs, 'cellPart', key);
        else this.setAttribute(attrs, key, true);
      } else if (key_lc === 'imagecoords') {
        let imageCoords = v[2].replace(/"((?:[^"\\]|\\[^"])*)"/mg, ($0,$1) => { return '"$'+btoa($1)+'$"' });
        imageCoords = imageCoords.split(/\s+/).map( (v) => { return v.replace(/"\$([^"]*)\$"/mg, ($0,$1) => { return atob($1) } ) } );
        this.setImageCoords('ASC',imageCoords,{});
      } else if (key_lc !== 'thumbnail') {
        this.setAttribute(attrs, key, v[2]);
      }
    } else if (tov0 == 'number') {
      if (!branchPoint) branchPoint = this.point$.nR; // start of branch
      if (v.length==5) v.pop() // ignore section number
      if (v.length==4) { 
        v[3] *= 0.5; // replace diameter by radius 
        this.point$.pushRow(v);
      } else throw(Error('Neurolucida ASC: expecting point to have 4 or 5 elements.'));
    } else {
      // branch
      children.push([i,this.point$.nR-branchPoint]);
    }
  }
  const numPoints = this.point$.nR-branchPoint;
  if (branchPoint !== undefined) {
    // create line
    tag = tag || (numPoints ? 'tree' : 'unknown')
    if (tag == 'tree' && parentLineId>0) {
      // inherit type
      var parentLine = this.line$.row(parentLineId)
      var typeId = parentLine[0]
    } else {
      if (attrs.type) { 
        this.setAttribute(attrs, 'cellPart', attrs.type);
        delete attrs.type
      }
      var swcType = this.matchType(tag,attrs)
      var typeId = this.createType(swcType,attrs)
    }
    parentLineId = this.pushLine([
      typeId,
      branchPoint,
      numPoints,
      parentLineId,
      negOffset
    ],attrs)
  } else {
    // attach attributes to parent line
    var parentLine = this.line$.row(parentLineId)
    if (attrs) this.setObjectProperties(parentLine[1],attrs)
  }
  for (i=0; i<children.length; i++) {
    var child = children[i]
    this.addBranchFromASC(data[child[0]],parentLineId,numPoints-child[1])
  }
}

neurolucida_class.prototype.treeFromASC = function(ascStr,fileName) {
  let data = this.jsonFromASC(ascStr);
  try {
    data = JSON.parse(data);
  } catch(e) {
    throw(Error('Neurolucida ASC: Could not convert the file to valid JSON: '+e));
  }
  this.addBranchFromASC(data,0,0);
  const customProperties = tree_class.compressProperties(this.objectProperties);
  return new tree_class(fileName,{},{},this.getCustomTypes(),customProperties,this.point$.toMatrix(),this.line$.toMatrix());
}


/**
 * module exports (used by the nodejs platform)
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {tree_class:tree_class,neurolucida_class:neurolucida_class,swc_class:swc_class}
  const swcPlus = require('./swcPlus_typeLibrary.js')
  var xmldom = require('xmldom')
  var DOMParser = xmldom.DOMParser
  var XMLSerializer = xmldom.XMLSerializer
  var xpath = require('xpath')
  require('./vkbeautify.js')
  var swcPlus_version = swcPlus.version
  var swcPlus_typeId = swcPlus.typeId
  var swcPlus_schema = swcPlus.schema
  var btoa = function (s) { return new Buffer(s).toString('base64') }
  var atob = function (b64) { return new Buffer(b64,'base64').toString() }
}