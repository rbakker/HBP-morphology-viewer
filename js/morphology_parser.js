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

function assertArray(a) {
  return a === undefined ? [] : (Array.isArray(a) ? a : [a])
}
  
function assertObject(a) {
  return typeof a === 'object' ? a : {}
}

/** 
 * Matrix class with fixed number of rows and columns.
 * @constructor
 * @param {TypedArray_class} dataType - the data type of the matrix elements
 * @param {int} numRows - number of rows
 * @param {int} numCols - number of columns
 */
function matrix_class(dataType,numRows,numCols) {
  this.nR = numRows
  this.nC = numCols
  this.data = new dataType(numRows*numCols)
}

/**
 * Returns a matrix row, which can be edited in place.
 * @param {int} r - row to retrieve
 * @returns {TypedArray}
 */
matrix_class.prototype.row = function(r) {
  var i = r*this.nC
  return this.data.subarray(i,i+this.nC)
}

matrix_class.prototype.lastRow = function() {
  return this.row(this.nR-1)
}

/**
 * Copies the content of `values` into row `r`.
 * @param {int} r - target row
 * @param {Array} values - source values
 */
matrix_class.prototype.setRow = function(r,values) {
  var row = this.row(r)
  row.set(values)
  return row
}

matrix_class.prototype.toArray = function(numDecimals) {
  var ans = []
  for (var r=0; r<this.nR; r++) ans.push(Array.from(this.row(r)))
  if (numDecimals !== undefined) {
    var f = parseFloat('1e'+numDecimals)
    for (var r=0; r<this.nR; r++) ans[r] = ans[r].map( function(x) { return Math.round(x*f)/f })
  }
  return ans
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
  this.nR = 0
  this.nC = numCols
  this.blocks = []
  this.dataType = dataType
}
  
/**
 * Returns a matrix row, which can be edited in place.
 * If `r` exceeds the number of rows, the matrix is expanded by 256-row increments.
 * @param {int} r - row to retrieve
 * @returns {TypedArray}
 */
varMatrix_class.prototype.row = function(r) {
  var b = (r >> 8)
  var block = this.blocks[b]
  if (!block) 
    block = this.blocks[b] = new this.dataType(256*this.nC)
  if (r >= this.nR) this.nR = r+1
  var i = (r-(b << 8))*this.nC
  return block.subarray(i,i+this.nC)
}

varMatrix_class.prototype.lastRow = matrix_class.prototype.lastRow

varMatrix_class.prototype.setRow = matrix_class.prototype.setRow

/**
 * Pushes a new row to the matrix with the content of `values`.
 * @param {int} r - target row
 * @param {Array} values - source values
 */
varMatrix_class.prototype.pushRow = function(values) {
  this.setRow(this.nR,values)
  return this.nR-1
}

/**
  * Converts a varMatrix to a fixed size matrix
  * @returns {matrix_class}
  */
varMatrix_class.prototype.toMatrix = function() {
  var nR = this.nR, nC = this.nC
  var M = new matrix_class(this.dataType,nR,nC)
  for (var b=0; b<this.blocks.length; b++) {
    var block = this.blocks[b]
    if (!block) continue
    var r0 = b << 8
    var r1 = (b+1) << 8
    if (r1 >= nR) {
      var view = M.data.subarray(r0*nC,nR*nC)
      view.set(block.subarray(0,(nR-r0)*nC))
    } else {
      var view = M.data.subarray(r0*nC,r1*nC)
      view.set(block)
    }
  }
  return M
}

var bytes_class = function(data,pos) {
  this.data = data
  this.pos = (pos || 0)
}

/**
 * NeurolucidaDAT blocks have a content-type;
 * this defines a mapping from index to type.
 * @const {map}
 */
bytes_class.prototype.nrlcdTypes = {
  0x0001: 'string',
  0x0101: 'sample',
  0x0102: '?',
  0x0103: 'sample list',
  0x0104: 'property',
  0x0105: 'property list',
  0x0201: 'contour',
  0x0202: 'tree',
  0x0203: 'subtree',
  0x0204: 'markerset',
  0x0205: 'markerset list',
  0x0206: 'spine',
  0x0207: 'spine list',
  0x0208: 'text',
  0x0209: 'subtree',
  0x0210: 'unknown',
  0x0401: 'thumbnail',
  0x0402: 'description',
  0x0403: 'image data'
}

bytes_class.prototype.readType = function(expectedType) {
  this.tp = this.readUint16()
  if (expectedType !== undefined)
    if (this.tp & expectedType != expectedType) throw 'Neurolucida DAT: Expecting '+expectedType+': "'+this.nrlcdTypes[expectedType]+'" but got '+this.tp+': "'+this.nrlcdTypes[this.tp]+'".'
  return this.tp
}

bytes_class.prototype.readUint8 = function() { this.pos += 1; return this.data.getUint8(this.pos-1,true); }
bytes_class.prototype.readUint16 = function() { this.pos += 2; return this.data.getUint16(this.pos-2,true); }
bytes_class.prototype.readUint32 = function() { this.pos += 4; return this.data.getUint32(this.pos-4,true); }
bytes_class.prototype.readFloat32 = function() { this.pos += 4; return this.data.getFloat32(this.pos-4,true); }
bytes_class.prototype.getUint8 = function(offset) { return this.data.getUint8(this.pos+offset,true) }
bytes_class.prototype.getUint16 = function(offset) { return this.data.getUint16(this.pos+offset,true) }
bytes_class.prototype.getUint32 = function(offset) { return this.data.getUint32(this.pos+offset,true) }
bytes_class.prototype.getFloat32 = function(offset) { return this.data.getFloat32(this.pos+offset,true) }


function swcTypeSpec(type,spec) {
  if (!spec) spec = {}
  var update = swcPlus_schema.swcPlus.customTypes[type]
  if (update) {
    for (var k in update) {
      if (k.charAt(0) != '_' && spec[k] === undefined) spec[k] = update[k]
    }
    if (update._extends) spec = swcTypeSpec(update._extends,spec)
  }
  return spec
}


function tree_class(fileName,swcAttrs,metaData,customTypes,customProperties,points,lines) {
  this.fileName = fileName
  this.swcAttrs = swcAttrs
  this.metaData = metaData
  this.customTypes = customTypes
  this.customProperties = customProperties
  this.srs = 'local' // spatial reference system
  /* generate the typeMap, indexed by TypeId */
  var typeMap = {}
  for (var type in customTypes) {
    var ct = assertArray(customTypes[type])
    for (var j=0; j<ct.length; j++) {
      var attrs = this.cloneObject(ct[j]);
      attrs.__type__ = type;
      typeMap[attrs.id] = this.insertDefaults(type,attrs);
    } 
  }
  /* add SWC standard types if not already present */
  typeMap['0'] || (typeMap['0'] = this.insertDefaults('undefined',{}))
  typeMap['1'] || (typeMap['1'] = this.insertDefaults('soma',{}))
  typeMap['2'] || (typeMap['2'] = this.insertDefaults('axon',{}))
  typeMap['3'] || (typeMap['3'] = this.insertDefaults('dendrite',{}))
  typeMap['4'] || (typeMap['4'] = this.insertDefaults('apical',{}))
  
  this.typeMap = typeMap
  this.points = points
  this.lines = lines // each row contains type, start, length, parent point, parent line
  // add derived data: properties, children and line names
  this.initProperties()
  this.updateChildren()
  this.updateBoundingBox()
}

tree_class.prototype.updateChildren = function() {
  var lenLines = this.lines.nR
  var children = new Array(lenLines)
  for (var i=0; i<children.length; i++) children[i] = []
  // populate children
  var row,p
  for (var lineId=1; lineId<lenLines; lineId++) {
    row = this.lines.row(lineId)
    children[row[3]].push(lineId)
  }
  this.children = children
}

tree_class.prototype.initProperties = function() {
  var pp = this.pointPropertySets = {}
  var op = this.objectPropertySets = {}
  var cp = this.customProperties && this.customProperties.for
  if (cp) for (var i=0; i<cp.length; i++) {
    var p = cp[i].points
    var o = cp[i].objects
    var kv = cp[i].set
    if (p) for (var j=0; j<p.length; j++) {
      var pj = p[j]  
      if (pp[pj]) pp[pj].push(kv); else pp[pj] = [kv]
    }
    if (o) for (var j=0; j<o.length; j++) {
      var oj = o[j]  
      if (op[oj]) op[oj].push(kv); else op[oj] = [kv]
    }
  }
}

tree_class.prototype.updateBoundingBox = function() {
  var row = this.points.row(1)
  var mn = Array.from(row), mx = Array.from(row)
  for (var r=2; r<this.points.nR; r++) {
    row = this.points.row(r)
    if (mn[0]>row[0]) mn[0] = row[0]
    if (mn[1]>row[1]) mn[1] = row[1]
    if (mn[2]>row[2]) mn[2] = row[2]
    if (mx[0]<row[0]) mx[0] = row[0]
    if (mx[1]<row[1]) mx[1] = row[1]
    if (mx[2]<row[2]) mx[2] = row[2]
  }
  this.boundingBox = {mn:mn,mx:mx}
}

tree_class.prototype.insertDefaults = function(type,attrs) {
  var spec = swcPlus_schema.swcPlus.customTypes[type]
  if (attrs.__type__ === undefined) attrs.__type__ = type
  for (var k in spec) {
    if (k.charAt(0) != '_' && attrs[k] === undefined && spec[k][0] !== null) attrs[k] = spec[k][0]
  }
  if (spec._extends) attrs = this.insertDefaults(spec._extends,attrs)
  return attrs
}

tree_class.prototype.cloneObject = function(p) {
  var q = {}
  for (var k in p) q[k] = p[k]
  return q
}

tree_class.prototype.getTypeName = function(tp) {
  return this.typeMap[tp].name || this.typeMap[tp].__type__
}

tree_class.prototype.getType = function(lineId) {
  return this.lines.row(lineId)[0]
}

tree_class.prototype.getLineName = function(lineId) {
  var line = this.lines.row(lineId)
  var p = line[3]
  if (p == lineId) {
    throw 'Tree: Line '+lineId+' has itself as parent.'
  }
  var tp = line[0]
  var p_line = this.lines.row(p)
  var p_tp = p_line[0]
  var p_ch = this.children[p]
  if (tp == p_tp) {
    return this.getLineName(p)+'.'+String(p_ch.indexOf(lineId)+1)
  } else {
    var count = 1
    var name = this.getTypeName(tp)
    for (var c=0; p_ch[c]!=lineId; c++) {
      var row = this.lines.row(p_ch[c])
      if (this.getTypeName(row[0]) == name) count++
    }
    if (count == 1) {
      // check if there is only one child with this name
      for (c++; c<p_ch.length; c++) {
        var row = this.lines.row(p_ch[c])
        if (this.getTypeName(row[0]) == name) return name+' #1'
      }
      return name
    }
    return name+' #'+count;
  }
}

tree_class.prototype.getLineKey = function(lineId) {
  var line = this.lines.row(lineId)
  var p = line[3]
  if (p == lineId) {
    throw 'Tree: Line '+lineId+' has itself as parent.'
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
  var ch,r,tp
  for (var i=0; i<children.length; i++) {
    ch = children[i]
    tp = this.lines.row(ch)[0]
    try {
      r = this.typeMap[''+tp].group
    } catch(e) {
      this.typeMap[tp] = this.insertDefaults('base',{})
      console.log('Unknown SWC type '+tp+' on line '+ch+'.')
      r = this.typeMap[0]
    }
    groups[r] || (groups[r] = [])
    groups[r].push(ch)
  }
  return groups
}

tree_class.prototype.getLimits = function(lineId) {
  lineId = (lineId || 0)
  // get limits of current line
  var line = this.lines.row(lineId)
  var mn = Array.from(this.points.row(line[1]))
  mn.pop()
  var mx = Array.from(this.points.row(line[1]))
  mx.pop()
  for (var i=line[1]+1; i<line[1]+line[2]; i++) { // CORRECTED
    var pt = this.points.row(i)
    if (pt[0]<mn[0]) mn[0] = pt[0]
    if (pt[1]<mn[1]) mn[1] = pt[1]
    if (pt[2]<mn[2]) mn[2] = pt[2]
    if (pt[0]>mx[0]) mx[0] = pt[0]
    if (pt[1]>mx[1]) mx[1] = pt[1]
    if (pt[2]>mx[2]) mx[2] = pt[2]    
  }
  // combine with limits of child lines
  var children = this.children[lineId]
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

tree_class.prototype.swcPoints = function(numDecimals) {
  var swcPoints = []
  var id = 0
  var lenLines = this.lines.nR
  for (var lineId=1; lineId<lenLines; lineId++) {
    var line = this.lines.row(lineId)
    var p = line[3]
    var negOffset = line[4]
    var iParent = -1
    if (p>0) {
      var parent = this.lines.row(p)
      iParent = parent[1]+parent[2]-1-negOffset // CORRECTED
    }
    var tp = line[0]
    for (var i=line[1]; i<line[1]+line[2]; i++) { // CORRECTED
      id += 1
      var point = this.points.row(i)
      var rounded = []
      if (numDecimals) {
        var f = parseFloat('1e'+numDecimals)
        for (var j=0; j<4; j++) rounded.push( Math.round(point[j]*f)/f )
      } else {
        rounded = point
      }
      swcPoints.push([
        id,
        line[0],
        rounded[0],
        rounded[1],
        rounded[2],
        rounded[3],
        iParent
      ])
      iParent = i
    }
  }
  return swcPoints
}

tree_class.prototype.toSWC = function(format) {
  const swcDict = this.swcAttrs;
  swcDict.metaData = this.metaData;
  swcDict.customTypes =  this.customTypes
  swcDict.customProperties = this.customProperties
  if (format == 'hmv') {
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
  } else {
    const parser = new DOMParser();
    swcDict.swcPoints = this.swcPoints(3)
    if (format == 'jwc') {
      return JSON.stringify(swcDict,null,2)
    } else {
      const xmlDoc = parser.parseFromString('<swcPlus></swcPlus>',"text/xml");
      if (format == 'xwc') {
        // xwc format: swc-like XML, with points and lines
        xmlLib.fromDict(xmlDoc.documentElement,swcDict,swcPlus_schema['swcPlus'])
        const xml = (new XMLSerializer()).serializeToString(xmlDoc).replace(/"/g,"'").replace(/&quot;/g,'"')
        return vkbeautify.xml(xml)
      } else {
        // swc format: put XML header in comment section, followed by space-separated points
        const swcPoints = swcDict.swcPoints
        delete swcDict.swcPoints
        xmlLib.fromDict(xmlDoc.documentElement,swcDict,swcPlus_schema['swcPlus'])
        const xmlHeader = (new XMLSerializer()).serializeToString(xmlDoc).replace(/"/g,"'").replace(/&quot;/g,'"')
        const swc = ['# '+vkbeautify.xml(xmlHeader).split('\n').join('\n# ')+'\n#']
        for (var i=0; i<swcPoints.length; i++) {
          swc.push( swcPoints[i].join(' ') )
        }
        return swc.join('\n')       
      }
    }
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
  var tfList = assertArray(spatialRegistration && spatialRegistration.transformation)
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
    const a = xmlElem.attributes
    const attrs = {}
    for (var i=0; i<a.length; i++) {
      let a_i = a[i]
      attrs[a_i.name] = a_i.value
    }
    return attrs
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
    const dict = {}
    for (var i=0; i<xmlNodeCollection.length; i++) {
      const elem = xmlNodeCollection[i]
      var tagName, childDict
      const Node_TEXT_NODE = 3
      const Node_COMMENT_NODE = 8
      if (elem.nodeType == Node_COMMENT_NODE) ;
      else if (elem.nodeType == Node_TEXT_NODE) {
        // ignore whitespace-only text
        if (!elem.data.trim().length) continue
        tagName = '_'
        childDict = elem.data
      } else {
        tagName = elem.tagName
        childDict = xmlLib.toDict(elem.childNodes)
        var attrs = xmlLib.attributes(elem)
        // if (tagName.substr(-5,5) == '.json') 
        for (var k in attrs) {
          if (k.substr(-5,5) == '.json') {
            childDict[k.substr(0,k.length-5)] = JSON.parse(attrs[k])
          } else if (k.substr(-4,5) == '.csv') {
            childDict[k.substr(0,k.length-4)] = JSON.parse('['+attrs[k]+']')
          } else {
            childDict[k] = attrs[k]
          }
        }
      }
      if (dict[tagName]) {
        dict[tagName] = assertArray(dict[tagName])
        dict[tagName].push(childDict)
      } else {
        dict[tagName] = childDict
      }
    }
    return dict
  },
  /**
   * Conversion of dict to XML, whereby scalar values become attributes, 
   * arrays and child-dicts become child-elements
   */
  fromDict: function(xmlNode,dict,schema) {
    var xmlDoc = xmlNode.ownerDocument
    if (!schema) schema = {}
    var isScalar = function(x) {
      return ['number','string','boolean','null'].indexOf(typeof x) > -1
    }
    var isSimple = function(x) {
      return ['number','string'].indexOf(typeof x) > -1
    }
    var isNumericArray = function(a) {
      return a.every( function(x) { return typeof x == 'number' } )
    }
    var isScalarArray = function(a) {
      return a.every( function(x) { return isScalar(x) } )
    }
    var isScalarArrayArray = function(aa) {
      return aa.every(function(a) { return Array.isArray(a) && isScalarArray(a) })
    }
    if (typeof dict != 'object' || Array.isArray(dict)) {
      // fix invalid dictionary
      dict = { '_':dict }
    }
    var elem, k,k0,v, useAttribute
    for (k in dict) {
      v = dict[k]
      k0 = k = k.trim()
      useAttribute = undefined
      try {
        // make sure k is a valid tag/attribute name
        xmlDoc.createElement(k)
      } catch(e) {
        // otherwise do the .json trick 
        k = '_.json'
        v = JSON.stringify({k:v})
      }
      // choose most compact notation
      if (Array.isArray(v)) {
        // convert numeric arrays to csv
        if (isNumericArray(v)) {
          k += '.csv'
          v = v.join(',')
        } else if (isScalarArray(v)) {
          k += '.json'
          v = JSON.stringify(v.map(JSON.stringify),[],2)
        } else if (isScalarArrayArray(v)) {
          k += '.json'
          v = JSON.stringify(v).replace(/\],\[/g,'],\n[')
        }
      }
      // check schema to see if attribute must be used instead of element
      if (schema[k0]) {
        useAttribute = Array.isArray(schema[k0])
        if (useAttribute && !isSimple(v)) {
          k += '.json'
          v = JSON.stringify(v)
        }
      }
       
      if (typeof v == 'object') {
        if (Array.isArray(v)) {
          // create multiple elements with the same tag name
          for (var i=0; i<v.length; i++) {
            var v_i = v[i]
            if (typeof v_i == 'object' && !Array.isArray(v_i)) {
              // apply fromDict recursively
              elem = xmlDoc.createElement(k)
              xmlLib.fromDict(elem,v_i,schema[k0])
            } else {
              if (!isSimple(v_i)) {
                k += '.json'
                v_i = JSON.stringify(v_i)
              }
              elem = xmlDoc.createElement(k)
              elem.appendChild(xmlDoc.createTextNode(v_i))
            }
            xmlNode.appendChild(elem)
          }
        } else {
          // apply fromDict recursively
          elem = xmlDoc.createElement(k)
          xmlLib.fromDict(elem,v,schema[k0])
          xmlNode.appendChild(elem)
        }
      } else {
        if (!isSimple(v)) {
          k += '.json'
          v = JSON.stringify(v)
        }
        if (k == '_') {
          xmlNode.appendChild( xmlDoc.createTextNode(v) )
        } else if (useAttribute === false) {
          elem = xmlDoc.createElement(k)
          elem.appendChild( xmlDoc.createTextNode(v) )
          xmlNode.appendChild(elem)
        } else {
          // create compact XML with attributes
          xmlNode.setAttribute(k,v)
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
  var lenSamples = swcPoints.length+1
  var point$ = new matrix_class(Float32Array,lenSamples,4)
  var longArray = lenSamples<=65536 ? Uint16Array : Uint32Array
  var parent$ = new Uint32Array(lenSamples)
  var i2sample$ = new Uint32Array(lenSamples)
  var type$ = new Uint16Array(lenSamples)
  var values
  var i,p,s
  var numSamples = 0
  var minSample, maxSample
  for (i=1; i<=swcPoints.length; i++) {
    values = swcPoints[i-1]    
    if (values.length < 7) {
      console.log('File "'+fileName+'": Skipping line '+JSON.stringify(values)+': need 7 values.')
      continue
    }
    s = values[0]
    p = values[6]
    if (s<0) {
      console.log('File "'+fileName+'": Sample# must be larger than or equal to zero.')
      break
    }
    numSamples += 1
    i2sample$[i] = s
    if (minSample>s || minSample === undefined) minSample = s
    if (maxSample<s || maxSample === undefined) maxSample = s
    var point = point$.row(numSamples)
    for (var j=0; j<4; j++) point[j] = values[2+j]
    parent$[numSamples] = p >= 0 && p != s ? p : 0 // 0 indicates no parent (root)
    var tp = values[1]
    type$[numSamples] = tp
  }
  
  // map sample numbers to sample indices
  lenSamples = numSamples+1
  var sample2i$ = i2sample$
  var nontrivial = false
  for (i=1; i<=numSamples; i++) {
    if (i2sample$[i]-minSample+1 != i) { nontrivial=true; break }
  }
  if (nontrivial) {
    sample2i$ = (maxSample-minSample+1 <= numSamples ? new longArray(lenSamples) : {})
    for (i=1; i<=numSamples; i++) {
      s = i2sample$[i]-minSample+1
      sample2i$[s] = i
    }
  }
  if (nontrivial || minSample != 1) {
    for (i=1; i<=numSamples; i++) {
      parent$[i] = sample2i$[parent$[i]-minSample+1]
    }
  }
  
  // determine whether each sample has single or multiple children of its own type
  var singleChild$ = new longArray(lenSamples)
  var isFork$ = new Uint8Array(lenSamples)
  isFork$[0] = 1 // root is always a fork
  var numLines = 0
  for (i=1; i<=numSamples; i++) {
    p = parent$[i]
    if (isFork$[p]) {
      numLines += 1 // existing fork: one new line
    } else {
      if (type$[i] == type$[p]) {
        if (singleChild$[p]) {
          numLines += 2 // new fork: two new lines
          singleChild$[p] = 0
          isFork$[p] = 1
        } else {
          singleChild$[p] = i
        }
      } else {
        numLines += 1 // type switch: one new line
      }
    }
  }
  // map points to lines
  var lenLines = numLines + 1
  var line$ = new matrix_class(longArray,lenLines,5)
  var point2line$ = new longArray(lenSamples)
  var numLines = 0
  for (i=1; i<=numSamples; i++) {
    p = parent$[i] // parent point id
    var tp = type$[i]
    var p_tp = type$[p]
    if (isFork$[p] || tp != p_tp) {
      numLines += 1 // existing fork: one new line
      var line = line$.row(numLines)
      line[0] = type$[i] // line type
      line[1] = i // line start point
      var len = 0
      for (var iLine=i; iLine!==0; iLine=singleChild$[iLine]) {
        point2line$[iLine] = numLines
        len++
      }
      line[2] = len // end minus start point // CORRECTED
      line[4] = p // parent point
    }
  }
  // get parent line from parent point
  for (s=1; s<=numLines; s++) {
    var line = line$.row(s)
    p = point2line$[line[4]] // parent line id
    line[3] = p
    var parentLine = line$.row(p)
    if (parentLine) {
      var lastPointParent = parentLine[1]+parentLine[2]-1 // CORRECTED
      // line[4] represents negOffset, 0 means that it connects to the last point of its parent line
      line[4] = lastPointParent-line[4] 
    } else {
      line[4] = 0
    }
  }
  
  if (tryStandardize) {
    // sort lines in canonical order
    var sortBy = [[]]
    for (s=1; s<=numLines; s++) {
      var id = [s]
      for (p=line$.row(s)[3]; p; p=line$.row(p)[3]) {
        id.unshift(p) // parent line
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
    var permuteLine$ = false
    for (var r=1; r<sortBy.length; r++) {
      s = sortBy[r].pop();
      if (r != s) { 
        if (!permuteLine$) permuteLine$ = new longArray(lenLines);
        permuteLine$[s] = r
      }
    }
    if (permuteLine$) {
      var sorted$ = new matrix_class(longArray,lenLines,5)
      for (s=1; s<=numLines; s++) {
        var r = (permuteLine$[s] || s)
        var row = sorted$.setRow(r,line$.row(s))
        p = row[3]
        row[3] = (permuteLine$[p] || p) // also permute line's parent line
      }
      line$ = sorted$
      console.log('File "'+fileName+'": Lines permuted to canonical order.')
    }

    // sort points in canonical order
    var permutePoint$ = false
    var numSorted = 0
    for (var s=1; s<=numLines; s++) {
      i = line$.row(s)[1]
      for (var iSeq=i; iSeq!==0; iSeq=singleChild$[iSeq]) {
        numSorted += 1
        if (numSorted != iSeq) {
          if (!permutePoint$) permutePoint$ = new longArray(lenSamples)
          permutePoint$[iSeq] = numSorted
        }
      }
    }  
    if (permutePoint$) {
      var sorted$ = new matrix_class(Float32Array,lenSamples,4)
      for (i=1; i<=numSamples; i++) {
        var r = permutePoint$[i]
        if (!r) { r = permutePoint$[i] = i }
        sorted$.setRow(r,point$.row(i))
      }
      point$ = sorted$
      for (s=1; s<=numLines; s++) {
        var line = line$.row(s)
        line[1] = permutePoint$[line[1]] // permute line's start point
      }
      console.log('File "'+fileName+'": Points permuted to canonical order.')
    }
  }
  return [point$,line$]  
}

swc_class.prototype.treeFromSWC = function(swcStr,fileName) {
  var parts = fileName.split('.')
  var ext = parts[parts.length-1].toLowerCase()
  if (ext == 'hmv') {
    var tree = JSON.parse(swcStr)
    var points = matrixFromArray(tree.treePoints.data,Float32Array)
    var lines = matrixFromArray(tree.treeLines.data,Uint32Array)
    return new tree_class(fileName,{version:tree.version},tree.metaData,tree.customTypes,tree.customProperties,points,lines);
  }
  
  // get SWC header, convert XML to json
  var header = []
  var re = /\s*# ?(.*)$/mg
  var matches
  while ((matches = re.exec(swcStr)) !== null) {
    header.push(matches[1])
  }
  header = header.join('\n')
  var swcAttrs={}, metaData, customTypes, customProperties
  // note: swcPlus version information is not used
  if (header.match(/^\s*<swcPlus version=[\'\"][\d\.]+[\'\"]/g) || header.match(/^\s*<swcPlus/g)) {
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(header,"text/xml");
    var err = xmlDoc.getElementsByTagName("parsererror")
    if (err.length) {
      throw 'XML error in SWC+ header of file '+fileName+': '+err[0].innerHTML
    }
    swcAttrs = xmlLib.attributes(xmlDoc.documentElement)
    metaData = xmlLib.toDict(xmlDoc.getElementsByTagName('metaData')).metaData
    customTypes = xmlLib.toDict(xmlDoc.getElementsByTagName('customTypes')).customTypes
    customProperties = xmlLib.toDict(xmlDoc.getElementsByTagName('customProperties')).customProperties
    header = undefined
  }
  if (!metaData) {
    metaData = {}
    if (header) metaData.originalHeader = header
  }
  if (!customTypes) customTypes = {}
  if (!customProperties) customProperties = {}
  // remove header/comments from SWC
  var result = swcStr.replace(/\s*#.*?$/mg,'')
  // remove empty lines and empty last line
  result = result.trim().replace(/^\s*$/mg,'')
  
  // store the data in memory-efficient typed arrays
  var swcPoints = result.split('\n')
  for (var i=0; i<swcPoints.length; i++) {
    var row = swcPoints[i].replace(/^\s+/m,'').replace(/\s+$/m,'').split(/[\s,]+/)
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
  
  var pointsLines = this.parsePoints(swcPoints,fileName,true)
  return new tree_class(fileName,swcAttrs,metaData,customTypes,customProperties,pointsLines[0],pointsLines[1]);
}

function neurolucida_class() {
  this.point$ = new varMatrix_class(Float32Array,4)
  this.point$.row(0) // add dummy row
  this.line$ = new varMatrix_class(Uint32Array,5)
  this.line$.pushRow([0,0,0,0,0])
  this.typeMap = {}
  this.customTypeId = 16
  this.customProperties = {'objects':{},'points':{}}
  
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

neurolucida_class.prototype.tag2geom = {
  "tree":"tree",
  "marker":"marker",
  "text":"marker",
  "property":"property",
  "spine":"marker"
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
  var swcType
  var geom = this.matchGeometry(tag,attrs)
  if (geom) {
    var typeByPart = this.typeByGeometryAndPart[geom]
    if (typeByPart) {
      var part = this.matchPart(tag,attrs)
      swcType = part && typeByPart[part.toLowerCase()]
    }
    swcType = swcType || geom
  }
  return swcType || 'unknown'
}

// store attributes as custom object/point properties
neurolucida_class.prototype.setCustomProperties = function(pointId,props,byObject) {
  var scope = byObject ? 'objects' : 'points'
  var cp = this.customProperties[scope]
  if (Object.keys(props).length) {
    var allProps = cp[pointId]
    if (allProps) for (var k in props) allProps[k] = props[k]
    else cp[pointId] = props
  }
}

neurolucida_class.prototype.createType = function(swcType,attrs) {
  var typeId
  var spec = swcTypeSpec(swcType)
  if (spec) {
    var swcAttrs = {}
    for (var k in attrs) {
      var k_lc = k.toLowerCase()
      if (spec[k_lc]) {
        var defVal = spec[k_lc][0] // default value
        if (defVal !== null && defVal === attrs[k]) {
          // remove attributes that are equal to the default value
          delete attrs[k]
        } else {
          var valType = spec[k_lc][1] // value-type
          if (valType) {
            // only attributes that have a value-type are part of the 
            // custom swc-type, all others are stored as object-properties
            swcAttrs[k_lc] = attrs[k]
            delete attrs[k]
          }
        }
      }
    }
    var typeKey = JSON.stringify([swcType,swcAttrs])
    typeId = this.typeMap[typeKey]
    if (!typeId) typeId = spec['id'][0]
    if (!typeId) {
      // new custom type, custom id
      typeId = this.customTypeId
      this.customTypeId += 1
    }
    this.typeMap[typeKey] = typeId
  }
  return typeId
}

neurolucida_class.prototype.pushLine = function(line,attrs) {
  // line[1] points to first point and equals objectId
  if (attrs) this.setCustomProperties(line[1],attrs,true)  
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
    if (customTypes[k].length == 1) customTypes[k] = customTypes[k][0]
  }
  return customTypes
}

neurolucida_class.prototype.getCustomProperties = function() {
  var idLists = {}
  for (var scope in this.customProperties) {
    var cp = this.customProperties[scope]
    for (var k in cp) {
      var props = cp[k]
      for (var m in props) {
        var propKV = JSON.stringify([m,props[m]])
        if (!idLists[propKV]) idLists[propKV] = {}
        var il = idLists[propKV]
        if (il[scope]) il[scope].push(parseInt(k))
        else il[scope] = [parseInt(k)]
      }
    }
  }
  var propLists = {}
  for (var propKV in idLists) {
    var idsKey = JSON.stringify(idLists[propKV])
    if (propLists[idsKey]) propLists[idsKey].push(propKV)
    else propLists[idsKey] = [propKV]
  }
  var customProperties = {}
  for (var idsKey in propLists) {
    var ids = JSON.parse(idsKey)
    var propKVs = propLists[idsKey]
    var propTree = ids // points, objects
    propTree['set'] = {}
    for (var i=0; i<propKVs.length; i++) {
      var kv = JSON.parse(propKVs[i])
      propTree['set'][ kv[0] ] = kv[1] // set key-value property
    }
    if (!customProperties.hasOwnProperty('for')) customProperties['for'] = []
    customProperties['for'].push(propTree)
  }
  return customProperties  
}

neurolucida_class.prototype.addBranchFromXML = function(xmlElem,parentLineId,negOffset) {
  var firstPoint = this.point$.nR
  var childNodes = xmlElem.childNodes
  var children = []
  var attrs = xmlLib.attributes(xmlElem)
  for (var i=0; i<childNodes.length; i++) {
    var ch = childNodes[i]
    var tag = ch.tagName
    if (!tag) continue
    if (tag === 'property') {     
      var key = ch.getAttribute('name')
      var fc = ch.firstChild
      if (fc && fc.tagName) attrs[key] = (fc.firstChild ? fc.firstChild.nodeValue : '')
    } else if (tag === 'point') {
      this.point$.pushRow([
        ch.getAttribute('x'),
        ch.getAttribute('y'),
        ch.getAttribute('z'),
        0.5*ch.getAttribute('d') // SWC stores radius, not diameter
      ])
    } else if (['spine','marker','branch'].indexOf(tag) > -1) {
      var offset = this.point$.nR-firstPoint
      children.push([ch,offset])
    } else {
      console.log('Neurolucida XML: unsupported xml tag "'+tag+'".')
    }
  }
  if (xmlElem.tagName == 'branch') {
    // inherit type
    var parentLine = this.line$.row(parentLineId)
    var typeId = parentLine[0]
  } else if (xmlElem.tagName == 'marker') {
    attrs.symbolName = attrs.type; delete attrs.type
    var marker = this.markers[attrs.symbolName]
    if (marker) {
      attrs.markerId = marker[0]
      attrs.symbol = marker[1]
    }
    var swcType = this.matchType(xmlElem.tagName,attrs)
    var typeId = this.createType(swcType,attrs)
  } else {
    if (attrs.type) { attrs.cellPart = attrs.type; delete attrs.type }
    delete attrs.GUID
    delete attrs.MBFObjectType
    var swcType = this.matchType(xmlElem.tagName,attrs)
    var typeId = this.createType(swcType,attrs)
  }
  parentLineId = this.pushLine([
    typeId,
    firstPoint,
    this.point$.nR-firstPoint,
    parentLineId,
    negOffset
  ],attrs)
  var parentLine = this.line$.row(parentLineId)
  for (i=0; i<children.length; i++) {
    var child = children[i]
    this.addBranchFromXML(child[0],parentLineId,parentLine[2]-child[1]) // CORRECTED
  }
}

neurolucida_class.prototype.treeFromXML = function(xmlStr,fileName) {
  xmlStr = xmlStr.replace('xmlns="http://www.mbfbioscience.com/2007/neurolucida"','');
  var parser = new DOMParser();
  var xmlDoc = parser.parseFromString(xmlStr,"text/xml");
  var rootObjects = ['tree','contour','marker','text']
  
  for (var t=0; t<rootObjects.length; t++) {
    var tag = rootObjects[t]
    var objElems = xmlLib.xPath(xmlDoc,'/mbf/'+tag);
    var elemCounter = 0    
    var objElem = objElems.iterateNext ? objElems.iterateNext() : objElems[elemCounter];
    while (objElem) {
      this.addBranchFromXML(objElem,0,0)
      elemCounter += 1
      objElem = objElems.iterateNext ? objElems.iterateNext() : objElems[elemCounter];
    }
  }
  return new tree_class(fileName,{},{},this.getCustomTypes(),this.getCustomProperties(),this.point$.toMatrix(),this.line$.toMatrix());
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

neurolucida_class.prototype.rgbFromDAT = function($bytes) {
  return '#'+this.hex2($bytes.readUint8())+this.hex2($bytes.readUint8())+this.hex2($bytes.readUint8())
}

neurolucida_class.prototype.stringFromDAT = function($bytes) {
  var tp = $bytes.readType(0x0001)
  var sz = $bytes.readUint32()
  var ans = ''
  for (var i=6; i<sz; i++) ans += String.fromCharCode($bytes.readUint8())
  return ans
}

neurolucida_class.prototype.propertyFromDAT = function($bytes) {
  var tp = $bytes.readType(0x0104)
  var sz = $bytes.readUint32()
  var nextPos = $bytes.pos+sz-6
  var key = this.stringFromDAT($bytes)
  var val = true
  var numValues = $bytes.readUint16()
  if (numValues) {
    var values = []
    while ($bytes.pos<nextPos) {
      var dataType = $bytes.readUint16()
     if (dataType == 0) {
        values.push( $bytes.readFloat32() )
      } else if (dataType == 1) {
        values.push( this.stringFromDAT($bytes) )
      } else if (dataType == 2) {
        values.push( this.stringFromDAT($bytes) )
      } else if (dataType == 3) {
        values.push( [$bytes.readUint8(),$bytes.readUint8(),$bytes.readUint8(),$bytes.readUint8()] )
      } else {
        console.log('Unknown dataType in propertyFromDAT: '+dataType)
      }
    }
    val = values.length > 1 ? values : values[0]
  }
  if ($bytes.pos != nextPos) {
    console.log('Neurolucida DAT: Not all bytes read from property '+key+' with value '+val) 
    $bytes.pos = nextPos
  }
  return [key,val]
}

neurolucida_class.prototype.propertyListFromDAT = function($bytes, $attrs) {
  var tp = $bytes.readType(0x0105)
  var sz = $bytes.readUint32()
  var nextPos = $bytes.pos+sz-6
  var len = $bytes.readUint16()
  while ($bytes.pos<nextPos) {
    var kv = this.propertyFromDAT($bytes)
    $attrs[kv[0]] = kv[1]
  }
  if ($bytes.pos != nextPos) {
    console.log('Neurolucida DAT: Not all bytes read from property list.') 
    $bytes.pos = nextPos
  }
}

neurolucida_class.prototype.sampleFromDAT = function($bytes) {
  var tp = $bytes.readType(0x0101);
  var sz = $bytes.readUint32()
  var nextPos = $bytes.pos+sz-6 
  var sample = new Float32Array(4)
  sample[0] = $bytes.readFloat32()
  sample[1] = $bytes.readFloat32()
  sample[2] = $bytes.readFloat32()
  sample[3] = 0.5*$bytes.readFloat32() // use radius instead of diameter
  if ($bytes.pos<nextPos) $bytes.readUint16() // section number, ignore
  return sample
}

neurolucida_class.prototype.samplelistFromDAT = function($bytes) {
  var tp = $bytes.readType(0x0103)
  var sz = $bytes.readUint32();
  var nextPos = $bytes.pos+sz-6 
  var len0 = $bytes.readUint16();
  var firstPoint = this.point$.nR
  while ($bytes.pos<nextPos) {
    this.point$.pushRow( this.sampleFromDAT($bytes) );
  }
  var len = this.point$.nR-firstPoint // length
  return [firstPoint,len]
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
neurolucida_class.prototype.contourFromDAT = function($bytes, parentId) {
  var tp = $bytes.readType(0x0201)
  var sz = $bytes.readUint32()
  
  var v = this.stringFromDAT($bytes)
  var attrs = { name: v };
  attrs.closed = ($bytes.readUint16() == 1)
  attrs.color = this.rgbFromDAT($bytes)
  attrs.alpha = $bytes.readUint8()
  var unknown
  ;(unknown = $bytes.readUint16()) && console.log('Neurolucida DAT: not zero!',unknown)
  attrs.unknown = unknown
  
  if ($bytes.getUint16(0) == 0x0105) {
    this.propertyListFromDAT($bytes, attrs)
    if (attrs.type) { attrs.cellPart = attrs.type; delete attrs.type }
    delete attrs.GUID
    delete attrs.MBFObjectType
  }
  var swcType = this.matchType('contour',attrs)
  var typeId = this.createType(swcType,attrs)
  var samples = this.samplelistFromDAT($bytes)
  return this.pushLine([typeId,samples[0],samples[1],parentId,0],attrs)
}

neurolucida_class.prototype.markersetFromDAT = function($bytes, parentLineId) {
  var tp = $bytes.readType(0x0204)
  var sz = $bytes.readUint32()

  var attrs = { symbolName : this.stringFromDAT($bytes) }
  var marker = this.markers[attrs.symbolName]
  if (marker) {
    attrs.markerId = marker[0]
    attrs.symbol = marker[1]
  }
  attrs.color = this.rgbFromDAT($bytes)
  attrs.alpha = $bytes.readUint8()
  if ($bytes.getUint16(0) == 0x0105) {
    this.propertyListFromDAT($bytes, attrs)
  }
  var swcType = this.matchType('marker',attrs)
  var typeId = this.createType(swcType,attrs)
  var samples = this.samplelistFromDAT($bytes)
  
  return this.pushLine([typeId,samples[0],samples[1],parentLineId,0],attrs)
}

neurolucida_class.prototype.spineFromDAT = function($bytes, parentLineId) {
  var tp = $bytes.readType(0x0206)
  var sz = $bytes.readUint32()
  var nextPos = $bytes.pos+sz-6 
  for (var i=0; i<3; i++) {
    var cc = $bytes.readUint16()
  }

  var attrs = { part:"spine" }
  if ($bytes.getUint16(0) == 0x0105) {
    this.propertyListFromDAT($bytes, attrs)
  }
  var parentOffset = $bytes.readUint16()
  
  var firstPoint = this.point$.nR
  while ($bytes.pos < nextPos) {
    tp = $bytes.getUint16(0)
    sz = $bytes.getUint32(2)
    if (tp == 0x0101) {
      this.point$.pushRow( this.sampleFromDAT($bytes) )
    } else {
      var typeName = (this.nrlcdTypes[tp] || tp)
      console.log('Neurolucida DAT: Unexpected type "'+typeName+'" ('+tp+') in spineFromDAT.')
      $bytes.pos += sz
    }
  }
  if ($bytes.pos != nextPos) throw('Error in reading spine from DAT-file: leftover bytes')
  var parentLine = this.line$.row(parentLineId)
  var negOffset = parentLine[2]-parentOffset
  if (negOffset < 0) throw('Error in reading spine from DAT-file: negative offset')
  var swcType = this.matchType('spine',attrs)
  var typeId = this.createType(swcType,attrs)
  return this.pushLine([typeId,firstPoint,1,parentLineId,negOffset],attrs)
}

neurolucida_class.prototype.branchFromDAT = function($bytes, parentLineId) {
  var tp = $bytes.readType(0x0203 | 0x0209)
  var sz = $bytes.readUint32()

  var attrs = {}
  var leafCode = $bytes.readUint16()
  var leaf = this.leafTypes[leafCode]
  if (leaf) attrs.leaf = leaf
  // silently ignore numBranches, it is inferred from the file structure  
  var numBranches = $bytes.readUint16() 

  var tp = $bytes.getUint16(0)
  while (tp == 0x0105) {
    this.propertyListFromDAT($bytes, attrs)
    tp = $bytes.getUint16(0)
  }
  var parentLine = this.line$.row(parentLineId)
  if (tp == 0x0103) {
    var samples = this.samplelistFromDAT($bytes)
    if (parentLineId === 0) {
      // this means that the parent line is root (type 0, point 0, len-1 0, parentLineId 0, negOffset 0)
      if (parentLine[1]+1 === line[1]) {
        parentLine[2] += line[2] // CORRECTED
      }
    } else {
      // add line to the branch
      parentLineId = this.pushLine([parentLine[0],samples[0],samples[1],parentLineId],attrs)
    }
  } else {
    this.setCustomProperties(parentLine[1],attrs,true)
  }
  return parentLineId
}

neurolucida_class.prototype.rootFromDAT = function($bytes, parentLineId) {
  var tp = $bytes.readType(0x0202)
  var sz = $bytes.readUint32()
  var attrs = {}
  var partId = $bytes.readUint16()
  if (partId == 0) attrs.cellPart = 'axon'
  else if (partId == 1) attrs.cellPart = 'dendrite'
  else if (partId == 2) attrs.cellPart = 'apical'
  attrs.color = this.rgbFromDAT($bytes)
  var unknown
  ;(unknown = $bytes.readUint8()) && console.log('Neurolucida DAT: not zero!',unknown)
  ;(unknown = $bytes.readUint8()) && console.log('Neurolucida DAT: not zero!',unknown)
  ;(unknown = $bytes.readUint8()) && console.log('Neurolucida DAT: not zero!',unknown)
  this.propertyListFromDAT($bytes, attrs)
  delete attrs.GUID
  var swcType = this.matchType('tree',attrs) 
  var typeId = this.createType(swcType,attrs)
  if ($bytes.getUint16(0) == 0x0101) {
    var firstPoint = this.point$.nR    
    this.point$.pushRow( this.sampleFromDAT($bytes) )
    parentLineId = this.pushLine( [typeId,firstPoint,1,parentLineId,0],attrs ) // new line becomes parent // CORRECTED
  } else {
    throw 'Neurolucida DAT: Tree without initial sample.'
  }
  return parentLineId
}

/**
 * Loads a generic block from binary Neurolucida data `bytes`, starting at position `pos`.
 * Block may contain sub-blocks.
 */
neurolucida_class.prototype.blockFromDAT = function($bytes, parentLineId) {
  var tp = $bytes.getUint16(0)
  var type = $bytes.nrlcdTypes[tp]
  if (!type) throw 'Neurolucida DAT: Unknown block type index "'+tp+'".'
  var sz = $bytes.getUint32(2)
  var nextPos = $bytes.pos+sz
  if (type == 'markerset') {
    parentLineId = this.markersetFromDAT($bytes, parentLineId)
  } else if (type == 'tree') {
    parentLineId = this.rootFromDAT($bytes, parentLineId)
  } else if (type == 'subtree') {
    parentLineId = this.branchFromDAT($bytes, parentLineId)
  } else if (type == 'contour') {
    parentLineId = this.contourFromDAT($bytes, parentLineId)
  } else if (type == 'spine') {
    parentLineId = this.spineFromDAT($bytes, parentLineId)
  } else if (type.substr(-4) == 'list') {
    $bytes.pos += 6
    var len = $bytes.readUint16() // list length not used, follows from parent size.
  } else if (type == 'image data') {
    console.log('ignoring image data')
    $bytes.pos = nextPos    
  } else if (type == 'description') {
    console.log('ignoring description')
    $bytes.pos = nextPos    
  } else if (type == 'property') {
    console.log('ignoring property')
    $bytes.pos = nextPos    
  } else if (type == 'unknown') {
    console.log('ignoring unknown')
    $bytes.pos = nextPos    
  } else {
    // unknown type, should not occur.
    console.log('Neurolucida DAT: Block type "'+type+'" ('+tp+') is not implemented (skipped) by the parser.')
    var attrs = { type:type }
    var swcType = this.matchType(type,attrs)
    var typeId = this.createType(swcType,attrs)
    parentLineId = this.pushLine( [typeId,0,1,parentLineId,0],attrs ) // CORRECTED
    $bytes.pos = nextPos
  }
  var maxIter = 1000
  while ($bytes.pos<nextPos && (maxIter--)) {
    this.blockFromDAT($bytes, parentLineId)
  }
}


neurolucida_class.prototype.treeFromDAT = function(arrayBuf,fileName) {
  var bytes = new DataView(arrayBuf);
  var head = new Uint8Array(arrayBuf,0,70);
  var token = 'V3 DAT file';
  for (var i=0; i<token.length; i++) {
    if (token.charCodeAt(i) != head[i+1]) {
      throw 'File does not have a valid Neurolucida V3 DAT header'
    }
  }
  var $bytes = new bytes_class(bytes,70)
  var attrs = {}
  var tp = $bytes.getUint16(0)
  while (tp == 0x0105) {
    this.propertyListFromDAT($bytes, attrs)
    tp = $bytes.getUint16(0)
  }
  if (attrs) {
    this.setCustomProperties(0,attrs,true)
  }
  
  var maxIter = 10000
  while ($bytes.pos<bytes.byteLength-4 && (maxIter--)) {
    this.blockFromDAT($bytes,0);
    if ($bytes.getUint32(0) === 0xAABBCCDD) break;
  }
  return new tree_class(fileName,{},{},this.getCustomTypes(),this.getCustomProperties(),this.point$.toMatrix(),this.line$.toMatrix())
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
  var json = ascStr
  // encode quoted words
  json = json.replace(/"((?:[^"\\]|\\[^"])*)"/mg,function($0,$1) { return '"$'+btoa($1)+'$"' });
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
  var firstPoint = this.point$.nR
  var children = [];
  var attrs = {};
  var data0 = data[0]
  var tag
  var i = 0
  if (data0 === '@marker') {
    tag = 'marker'
    attrs.symbolName = data[1]
    var marker = this.markers[attrs.symbolName]
    if (marker) {
      attrs.markerId = marker[0]
      attrs.symbol = marker[1]
    }
    i=2
  } else if (data0 === '@spine') {
    tag = 'spine'
    i=1
  } else if (data0 === '@contour') {
    tag = 'contour'
    attrs.name = data[1]
    i=2
  }
  for (; i<data.length; i++) {
    var v = data[i];
    if (!v.length) continue
    if (typeof v == 'string') {
      tag = 'marker'
      attrs.name = v
      continue
      //throw 'Neurlucida ASC: expecting array, not string "'+v+'"'
    }
    var v0 = v[0];
    var tov0 = typeof v0;
    if (v0 === '@attr') {
      var key = String(v[1]).toLowerCase();
      if (v.length === 2) {
        // see whether single unquoted string represents part
        var part = this.lc2part[key.toLowerCase()]
        if (part) attrs.cellPart = key
        else attrs[key] = true
      } else if (key !== 'thumbnail') {
        attrs[key] = v[2];
      }
    } else if (tov0 == 'number') {
      if (v.length==5) v.pop() // ignore section number
      if (v.length==4) { v[3] *= 0.5; this.point$.pushRow(v) }
      else throw 'Neurolucida ASC: expecting point to have 4 or 5 elements.'
    } else {
      children.push([i,this.point$.nR-firstPoint]);
    }
  }
  delete attrs['GUID']
  var numPoints = this.point$.nR-firstPoint
  if (numPoints) {
    // create line
    tag = tag || (numPoints ? 'tree' : 'unknown')
    if (tag == 'tree' && parentLineId>0) {
      // inherit type
      var parentLine = this.line$.row(parentLineId)
      var typeId = parentLine[0]
    } else {
      if (attrs.type) { attrs.cellPart = attrs.type; delete attrs.type }
      delete attrs.GUID
      delete attrs.MBFObjectType
      var swcType = this.matchType(tag,attrs)
      var typeId = this.createType(swcType,attrs)
    }
    parentLineId = this.pushLine([
      typeId,
      firstPoint,
      numPoints,
      parentLineId,
      negOffset
    ],attrs)
  } else {
    // attach attributes to parent line
    var parentLine = this.line$.row(parentLineId)
    if (attrs) this.setCustomProperties(parentLine[1],attrs,true)
  }
  for (var i=0; i<children.length; i++) {
    var child = children[i]
    this.addBranchFromASC(data[child[0]],parentLineId,numPoints-child[1])
  }
}

neurolucida_class.prototype.treeFromASC = function(ascStr,fileName) {
  var data = this.jsonFromASC(ascStr);
  try {
    data = JSON.parse(data)
  } catch(e) {
    throw 'Could not convert the Neurolucida ASC file to valid JSON: '+e
  }
  this.addBranchFromASC(data,0,0)
  return new tree_class(fileName,{},{},this.getCustomTypes(),this.getCustomProperties(),this.point$.toMatrix(),this.line$.toMatrix())
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