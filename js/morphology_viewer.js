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
 * TO DO
 * - [ok] Neurolucida XML: organize output
 * - [ok] Neurolucida DAT + ASC
 * - contours
 * - [ok] Allen Institute Data
 * - link to SBA (Allen Institute Data)
 * - [x] highlight list-node (instead of alert)
 * - SVG with polygons (using the cylinder code?)
 * - [ok] save as SWC+
 * 
 * Dependencies:
 * - morphology_parser.js, for loading/saving morphology files
 *   - SWCplus_TypeLibrary.js, which contains the SWCplus Type Library
 *   - vkbeautify.js, for producing pretty-print XML
 * 
 * Definitions:
 * - 'Line' is non-branching set of connected points, whereby branching
 *   is defined as having multiple children of the same Type.
 * 
 */
"use strict";
var VIEWER

function RuntimeError(msg,fatal) {
  var errorDiv = document.getElementById('RuntimeError');
  if (errorDiv) {
    errorDiv.innerHTML = msg;
    errorDiv.style.display = 'block';
  } else {
    alert('RuntimeError: '+msg);
  }
  if (fatal) throw('RuntimeError: '+msg)
}

var util = {
  getQueryVariable: function(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      if (decodeURIComponent(pair[0]) == variable) {
        return decodeURIComponent(pair[1]);
      }
    }
  },
  escapeHtml: function(text) {
    return String(text)
      .replace('&',"&amp;")
      .replace('<',"&lt;")
      .replace('>',"&gt;")
      .replace('"',"&quot;")
      .replace('\'',"&#039;");
  },
  cloneArray: function(p) {
    var q = []
    for (var i=0; i<p.length; i++) q.push(p[i])
    return q
  },
  hex2rgb: function(hex) {
    if (hex[0] == '#') hex = hex.substr(1);
    return [parseInt(hex.substr(0,2),16),parseInt(hex.substr(2,2),16),parseInt(hex.substr(4,2),16)];
  },
  hex2sfcolor: function(hex) {
    let rgb = util.hex2rgb(hex);
    return ''+Math.round(rgb[0]/2.55)/100+' '+Math.round(rgb[1]/2.55)/100+' '+Math.round(rgb[2]/2.55)/100;
  }
}

function toggleStatus(elem,sibl) {
  var contentElem = elem.parentNode.children[sibl]
  if (contentElem) {
    var classes = contentElem.className.split(' ')
    var status = classes[0].substr(8);
    status = (status=='open' ? 'closed' : 'open')
    classes[0] = 'content-'+status
    contentElem.className = classes.join(' ')
  }
  return status
}

toggleStatus.openClose = {open:'[&#8211;]',closed:'[+]'}
toggleStatus.showHide = {open:'<b>&#9668;</b>',closed:'&#9658;'}

function toggleOpenClose(elem,sibl,nodeId) {
  var contentElem = elem.parentNode.children[sibl]
  if (contentElem) {
    elem.parentNode.removeChild(contentElem)
    status = 'closed'
  } else {
    var contentElem = document.createElement('div')
    contentElem.innerHTML = VIEWER.nodeHtml(nodeId)
    contentElem.className = 'content-open'
    elem.parentNode.appendChild(contentElem)
    status = 'open'
  }
  elem.innerHTML = toggleStatus.openClose[status]
}

function toggleShowHide(elem,ch) {
  var status = toggleStatus(elem,ch)
  elem.innerHTML = toggleStatus.showHide[status]
}

function handleLineClick(lineElem) {
  var lineId = lineElem.id.split('_')[1]
  var name = VIEWER.tree && VIEWER.tree.getLineName(lineId)
  alert('You clicked on line# '+lineId+' named "'+name+'"');
}

/* from: http://inside.mines.edu/fs_home/gmurray/ArbitraryAxisRotation/
function rotateAboutLine(x,y,z,a,b,c,u,v,w,sinTheta,cosTheta) {
  var I_cosTheta = 1-cosTheta
  var xR = (a*(v*v+w+w)-u*(b*v+c*w-u*x-v*y-w*z))*I_cosTheta+x*cosTheta + (-c*v+b*w-w*y+v*z)*sinTheta
  var yR = (b*(u*u+w*w)-v*(a*u+c*w-u*x-v*y-w*z))*I_cosTheta+y*cosTheta + ( c*u-a*w+w*x-u*z)*sinTheta
  var zR = (c*(u*u+v*v)-w*(a*u+b*v-u*x-v*y-w*z))*I_cosTheta+z*cosTheta + (-b*u+a*v-v*x+u*y)*sinTheta
  return [xR,yR,zR]
}
*/

var vec3 = {
  sqr: function(x) { 
    return x*x; 
  },
  /* NOT USED
  cross: function(a,b) { 
    return [ a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0] ]
  }
  */
  cross010: function(a) { 
    return [ -a[2], 0, a[0] ]
  },
  // xyz: point to be rotated
  // uvw: rotation axis
  // sin(theta): sine of the rotation angle
  // cos(theta): cosine of the rotation angle
  rotateAboutOrigin: function(x,y,z,u,v,w,sinTheta,cosTheta) {
    var fixed = (u*x+v*y+w*z)*(1-cosTheta)
    var xR = u*fixed+x*cosTheta + (-w*y+v*z)*sinTheta
    var yR = v*fixed+y*cosTheta + (+w*x-u*z)*sinTheta
    var zR = w*fixed+z*cosTheta + (-v*x+u*y)*sinTheta
    return [xR,yR,zR]
  },
  diff: function(a,b) {
    return [b[0]-a[0],b[1]-a[1],b[2]-a[2]]
  },
  norm: function(a) {
    return Math.sqrt(vec3.sqr(a[0])+vec3.sqr(a[1])+vec3.sqr(a[2]))
  },
  normalize: function(a) {
    var norm = vec3.norm(a)
    return norm>0 ? [a[0]/norm,a[1]/norm,a[2]/norm] : a
  },
  plus: function(a,b) {
    return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]
  },
  dot: function(a,b) {
    return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
  },
  scale: function(a,f) {
    return [a[0]*f,a[1]*f,a[2]*f]
  }
}

/**
 * @constructor
 */
var viewer_class = function(tree) {
  // nodeList rows contain:
  //   0 lineId,
  //   1 groupId
  //   2 parentId
  //   3 firstChildId
  //   4 status (0 = inherit, 1 = visible, 9 = hidden)]
  this.tree = tree
  VIEWER = this // global variable VIEWER used in callback functions
  this.id2group = ['']
  this.createNodeList()
  this.spatialRegistration = {
    atlases: {},
    transforms: {}
  }
  this.interactiveMode = true
}

viewer_class.prototype.inheritedVisibility = function(nodeId) {
  // nodeList contains [0:lineId,1:groupId,2:parentId,3:firstChildId,4:visibility]
  var node = this.nodeList.row(nodeId)
  var visibility = node[4]
  if (visibility === 0) { // inherit
    var parentId = node[2]
    return (parentId > 0 ? this.inheritedVisibility(parentId) : 1)
  }
  return visibility
}

viewer_class.prototype.showNode = function(nodeId,makeVisible) {
  // nodeList contains [0:lineId,1:groupId,2:parentId,3:firstChildId,4:visibility]
  var node = this.nodeList.row(nodeId)
  var nodeElem = document.getElementById('node_'+nodeId)
  if (nodeElem) {
    nodeElem.checked = makeVisible
    var visibility = node[4]
    nodeElem.style.opacity = (visibility === 0 ? '0.5' : '1.0')
  }
  var lineId = node[0]
  if (lineId) {
    var xElem = document.getElementById('shape_'+lineId)
    if (xElem) { xElem.render = makeVisible }
    else if (makeVisible) this.insertLine(lineId)
  }
  // apply visibility to child nodes
  var childId = node[3]
  while (childId < this.nodeList.nR && this.nodeList.row(childId)[2] == nodeId) { // while child's parent is current node
    var child = this.nodeList.row(childId)
    // only children with visibility '0:inherit' need to be updated
    if (child[4] === 0) this.showNode(childId,makeVisible)
    childId += 1
  }
}

viewer_class.prototype.toggleNode = function(nodeId) {
  // nodeList contains [0:lineId,1:groupId,2:parentId,3:firstChildId,4:visibility]
  var node = this.nodeList.row(nodeId)
  var inherit = this.inheritedVisibility(node[2])
  var visibility = node[4]
  if (visibility === inherit || visibility === 0) visibility = 10-inherit // 9 means explicitly do not render
  else visibility = 0
  node[4] = visibility
  this.showNode(nodeId,(visibility || inherit) === 1)
}

viewer_class.prototype.defaultGroupVisibility = {
  // 0: inherit, 1: show, 9: hide
  "contours": 9,
  "borders": 9,
  "markers": 9,
  "spines": 9
}

viewer_class.prototype.getNodeName = function(nodeId) {
  var node = this.nodeList.row(nodeId)
  if (node[0]) return this.tree.getLineName(node[0])
  if (node[1]) return this.id2group[node[1]]
  return '?'
}

viewer_class.prototype.createChildNodes = function(nodeId) {
  // nodeList contains [0:lineId,1:groupId,2:parentId,3:firstChildId,4:visibility]
  var node = this.nodeList.row(nodeId)
  if (nodeId === 0 || node[0] > 0) { // if node contains a line
    var parentGroup = this.id2group[node[1]]
    var lineId = node[0]
    var groups = this.tree.getGroups(this.tree.children[lineId])
    if (groups) {
      node[3] = this.nodeList.nR // set firstChild
      var group
      for (var g in groups) {
        var visibility = this.defaultGroupVisibility[g] || 0
        members = groups[g]
        if (members.length > 1 && g !== '' && g !== parentGroup) {
          var len = this.id2group.push(g)
          this.nodeList.pushRow([0,len-1,nodeId,0,visibility])
        } else {
          var groupId = (g == parentGroup ? node[1] : this.id2group.push(g)-1)
          for (var i=0; i<members.length; i++) {
            var childId = members[i]
            this.nodeList.pushRow([childId,groupId,nodeId,0,visibility])
          }
        }
      }
    }
  } else {
    var parentNode = this.nodeList.row(node[2])
    var groups = this.tree.getGroups(this.tree.children[parentNode[0]])
    var g = this.id2group[node[1]]
    if (g) {
      var members = groups[g]
      node[3] = this.nodeList.nR // set firstChild
      for (var i=0; i<members.length; i++) {
        var childId = members[i]
        this.nodeList.pushRow([childId,node[1],nodeId,0,0])
      }
    }
  }
  return node[3] // firstChild
}

viewer_class.prototype.createNodeList = function(nodeId) {
  nodeId = nodeId || 0
  // nodeList contains [0:lineId,1:groupId,2:parentId,3:firstChildId,4:visibility]
  if (!nodeId) {
    this.nodeList = new varMatrix_class(Uint32Array,5)
    this.nodeList.pushRow([0,0,0,0,1])
  }
  var childId = this.createChildNodes(nodeId)
  if (childId) {
    while (childId < this.nodeList.nR && this.nodeList.row(childId)[2] == nodeId) { // while child's parent is current node
      this.createNodeList(childId);
      childId += 1
    }
  }
}

viewer_class.prototype.nodeHtml = function(nodeId) {
  // nodeList contains [0:lineId,1:groupId,2:parentId,3:firstChildId,4:visibility]
  var node = this.nodeList.row(nodeId)
  var lineId = node[0]
  var ans = '<ol class="node" style="display:block">'
  if (lineId) {
    var line = this.tree.lines.row(lineId)
    var tp = line[0]
    var firstPoint = line[1]
    var numPoints = line[2]
    var attrs = this.tree.typeMap[tp] || {}
    var op = this.tree.objectPropertySets[firstPoint]
    if (op) for (var i=0; i<op.length; i++) for (var k in op[i]) { attrs[k] = op[i][k] } 
    if (attrs) {
      var toggleSwitch = '<span class="toggle" onclick="toggleShowHide(this,1)">'+toggleStatus.showHide.closed+'</span>';
      ans += '<li>Attributes ('+Object.keys(attrs).length+')&nbsp;'+toggleSwitch+'<div class="content-closed"><pre>'+JSON.stringify(attrs,null,2)+'</pre></li>'
    }
    var toggleSwitch = '<span class="toggle" onclick="toggleShowHide(this,1)">'+toggleStatus.showHide.closed+'</span>';
    ans += '<li>Points ('+numPoints+')&nbsp;'+toggleSwitch+'<div class="content-closed">'
    var points = this.tree.points
    ans += '<pre>'
    for (var i=firstPoint; i<=firstPoint+numPoints-1; i++) {
      if (i>firstPoint) ans += '<br/>'
      var pt = points.row(i)
      ans += pt[0].toFixed(2)+' '+pt[1].toFixed(2)+' '+pt[2].toFixed(2)+' '+pt[3].toFixed(2)
    }
    ans += '</pre>'
    ans += '</div></li>'
  }

  //var firstChildId = this.createChildNodes(nodeId)
  var childId = node[3] // firstChild
  if (childId) {
    var li = [];
    while (childId < this.nodeList.nR && this.nodeList.row(childId)[2] == nodeId) { // while child's parent is current node
      li.push(this.listingHtml('h3',childId));
      childId += 1
    }
    ans += '<li>'+li.join('</li><li>')+'</li>';
  }
  ans += '</ol>';
  return nodeId ? '<div class="result">'+ans+'</div>' : ans
}

viewer_class.prototype.listingHtml = function(tagName,nodeId) {
  // nodeList contains [0:lineId,1:groupId,2:parentId,3:firstChildId,4:status]
  nodeId = nodeId || 0
  var node = this.nodeList.row(nodeId)
  var lineId = node[0]
  
  if (!tagName) tagName = 'h3';
  var status = 'open';
  if (node[2]>0)  status = 'closed'
  if (nodeId>0) {
    var toggleSwitch = '<div class="toggle" onclick="toggleOpenClose(this,2,'+nodeId+')">'+toggleStatus.openClose[status]+'&#160;</div>';
    var checked = (this.inheritedVisibility(nodeId) === 1) ? ' checked' : ''
    if (node[4] === 0) checked += ' style="opacity: 0.7"'
    var visibilitySwitch = '<input id="node_'+nodeId+'" type="checkbox"'+checked+' onchange="VIEWER.toggleNode(\''+nodeId+'\')"/>'
    var name = this.getNodeName(nodeId)
    var ans = toggleSwitch+' '+'<'+tagName+'>'+visibilitySwitch+' <span class="'+(lineId>0 ? 'line' : 'group')+'">'+name+(lineId>0 ? '' : '&nbsp;...')+'</span></'+tagName+'>';
  } else {
    var ans = '<'+tagName+'>'+this.tree.fileName+'</'+tagName+'>';
  }
  if (status == 'open') ans += this.nodeHtml(nodeId)
  return ans;
}

viewer_class.prototype.insertLine = function(lineId) {
  var line = this.tree.lines.row(lineId)
  var parentLineId = line[3]
  var parentElem = document.getElementById('X3D_SCENE')
  if (parentElem) {
    var lineElem = document.createElementNS("http://www.web3d.org/specifications/x3d-3.3.xsd",'Group')
    lineElem.innerHTML = this.lineXML(lineId)
    parentElem.appendChild(lineElem)
  } else {
    RuntimeError('X3D: Need root X3D element with id "X3D_SCENE".')
  }
}

viewer_class.prototype.lineSVG = function(projectSvg,lineId) {
  var points = this.tree.points
  var lines = this.tree.lines
  var line = lines.row(lineId)
  var tp = line[0] // type
  var firstPoint = line[1] // first point
  var numPoints = line[2] // line length
  var p = line[3] // parent line
  var attrs = this.tree.typeMap[tp]
  var swcType = attrs.__type__
  var geom = attrs.geometry
  
  var x3dSettings = (this.x3dSettings || {})
  var color = ('0 0 0')
  if (swcType == 'soma') color = (x3dSettings.somaColor || '0 0.9 0')
  else if (swcType == 'axon') color = (x3dSettings.axonColor || '0 0 1')
  else if (swcType == 'dendrite') color = (x3dSettings.dendriteColor || '1 0 0')
  else if (swcType == 'apical') color = (x3dSettings.apicalColor || '0.5 0 0')
  else if (swcType == 'spine') color = (x3dSettings.spineColor || '0.2 0.8 0.0')
  else if (geom == 'marker') color = (x3dSettings.markerColor || '0 0 0')

  var xml = []
  // open the svg shape
  if (geom != 'tree' && geom != 'contour') return;
  var rgb = color
  if (rgb.substr(0,1) != '#') {
    rgb = color.split(' ')
    rgb = [Math.floor(rgb[0]*255),Math.floor(rgb[1]*255),Math.floor(rgb[2]*255)]
    rgb = 'rgb('+rgb.join(',')+')'
  }
  var pr0 = projectSvg[0]
  var pr1 = projectSvg[1]
  var project2d = function(x) {
    return [
      pr0[0]*x[0]+pr0[1]*x[1]+pr0[2]*x[2],
      pr1[0]*x[0]+pr1[1]*x[1]+pr1[2]*x[2]
    ]
  }
  xml.push('<g id="'+this.tree.getLineName(lineId)+'">')
  // insert geometries
  var coords = []

  // geometries are lines
  if (geom == 'tree' && p) {
    var p_line = lines.row(p)
    var p_firstPoint = p_line[1]
    var p_len = p_line[2]
    var p_lastPoint = p_firstPoint+p_len-1
    var p_pt = points.row(p_lastPoint)
    if (projectSvg) coords.push( project2d([p_pt[0],p_pt[1],p_pt[2]]).join(' ') )
    else coords.push( [p_pt[0],p_pt[1],p_pt[2]].join(' ') )
  }
  var closed = (geom=='contour')
  var w = 0
  for (var i=firstPoint; i<firstPoint+numPoints; i++) {
    var pt = points.row(i)
    coords.push( project2d([pt[0],pt[1],pt[2]]).join(' ') )
    w += pt[3]*2 // radius => diameter
  }
  w /= numPoints
  var tag = (closed ? 'polygon' : 'polyline')
  var fill = (closed ? rgb : 'none')
  xml.push('<'+tag+' points="'+coords.join(' ')+'" style="fill:'+fill+';stroke:'+rgb+';stroke-width:'+w+'"/>')
  xml.push('</g>')
  return xml.join('\n')
}

viewer_class.prototype.renderSvg = function(projectSvg,nodeId,parentVisibility, xml) {
  if (!nodeId) {
    nodeId = 0
    xml = []
    parentVisibility = true
  }
  var node = this.nodeList.row(nodeId)
  var visibility = node[4] || parentVisibility // 0:inherit, 1:on, 9:off
  if (visibility === 1) {
    var lineId = node[0] // line number
    if (lineId) xml.push(this.lineSVG(projectSvg,lineId))
  }
  
  var childId = node[3] // firstChild
  if (childId) {
    while (childId < this.nodeList.nR && this.nodeList.row(childId)[2] == nodeId) { // while child's parent is current node
      this.renderSvg(projectSvg,childId,visibility, xml)
      childId += 1
    }
  }

  if (nodeId == 0) return xml.join('\n')
}

viewer_class.prototype.lineXML = function(lineId) {
  var points = this.tree.points
  var lines = this.tree.lines
  var line = lines.row(lineId)
  var tp = line[0] // type
  var firstPoint = line[1] // first point
  var numPoints = line[2] // line length
  var lastPoint = line[1]+line[2]-1
  var p = line[3] // parent line
  var attrs = this.tree.typeMap[tp]
  var swcType = attrs.__type__
  var geom = attrs.geometry
  
  var x3dSettings = (this.x3dSettings || {})
  var color = ('0 0 0')
  if (swcType == 'soma') color = (x3dSettings.somaColor || '0 0.9 0')
  else if (swcType == 'axon') color = (x3dSettings.axonColor || '0 0 1')
  else if (swcType == 'dendrite') color = (x3dSettings.dendriteColor || '1 0 0')
  else if (swcType == 'apical') color = (x3dSettings.apicalColor || '0.5 0 0')
  else if (swcType == 'spine') color = (x3dSettings.spineColor || '0.2 0.8 0')
  else if (geom == 'marker') color = (x3dSettings.markerColor || '0 0 0')
  if (color.charAt(0) == '#') color = util.hex2sfcolor(color);

  var renderMode = (x3dSettings.renderMode || 'thin')
  // draw soma as cones
  if (swcType == 'soma' && geom == 'tree' && (renderMode=='thin' || renderMode=='thick')) renderMode = 'cones'
  var xml = []
  // open the x3d shape
  xml.push('<Group'+ (this.interactiveMode ? ' id="shape_'+lineId+'" onclick="handleLineClick(this)">' : ' DEF="shape_'+lineId+'">'));
  // insert geometries
  var coords = []
  if (geom == 'contour' || swcType == 'marker' || swcType == 'spine' || renderMode == 'thin' || renderMode == 'thick') {
    // geometries are lines
    if (geom == 'tree' && p) {
      var p_line = lines.row(p)
      var p_firstPoint = p_line[1]
      var p_numPoints = p_line[2]
      var p_lastPoint = p_firstPoint+p_numPoints-1
      var p_pt = points.row(p_lastPoint)
      coords.push( [p_pt[0],p_pt[1],p_pt[2]].join(' ') )
    }
    var mn = this.tree.boundingBox.mn, mx = this.tree.boundingBox.mx
    var markerSize = (mx[0]-mn[0]+mx[1]-mn[1]+mx[2]-mn[2])/3
    markerSize /= (swcType == 'spine' ? 200 : 60) 
//    markerSize = [markerSize,markerSize,markerSize]
    var closed = (geom=='contour')
    if (geom == 'marker') {
      for (var i=firstPoint; i<=lastPoint; i++) {
        var pt = points.row(i)
        xml.push('<Transform translation="'+pt.slice(0,3).join(' ')+'"><Shape><Appearance>'+
          '<Material diffuseColor="'+color+'" specularColor="'+color+'" transparency=".4"></Material></Appearance>'+
          '<Sphere radius="'+markerSize+'"></Sphere></Shape></Transform>'
        )
      }
    } else {
      xml.push('<Shape><Appearance><Material emissiveColor="'+color+'"></Material>')
      if (renderMode == 'thick') xml.push('<LineProperties linetype="1" linewidthScaleFactor="4" applied="true"></LineProperties>')
      xml.push('</Appearance>')
      for (var i=firstPoint; i<=lastPoint; i++) {
        var pt = points.row(i)
        coords.push( [pt[0],pt[1],pt[2]].join(' ') )
      }
      if (closed) coords.push(coords[0])
      xml.push('<LineSet vertexCount="'+(coords.length)+'" containerField="geometry">')
      xml.push('<Coordinate point="'+coords.join(' ')+'"/>')
      xml.push('</LineSet>')
      xml.push('</Shape>')
    }
  } else {
    // geometries are cones, approximated as an indexed face set
    var a,rA,b,rB,c,rC,u_ab,u_bc,skip=0
    if (p) {
      var p_line = lines.row(p)
      var p_firstPoint = p_line[1]
      var p_numPoints = p_line[2]
      var p_lastPoint = p_firstPoint+p_numPoints-1
      a = Array.from(points.row(p_lastPoint))
      rA = a.pop()
      b = Array.from(points.row(firstPoint))
      rB = b.pop()
      if (p_line[0] != line[0]) rA = rB // so that axons do not inherit huge radius from soma
    }
    if (!b && numPoints > 0) {
      a = Array.from(points.row(firstPoint))
      rA = a.pop()
      b = Array.from(points.row(firstPoint+1))
      rB = b.pop()
      skip=1
    }
    if (b) {
      var circles = []
      u_ab = vec3.normalize(vec3.diff(a,b))
      var circle = x3d.startCircle(a,rA,u_ab)
      circles.push( circle )
      var prevCircle = circle
      for (var i=firstPoint+skip; i<=lastPoint; i++) {
        if (i<lastPoint) {
          c = Array.from(points.row(i+1))
          rC = c.pop()
          u_bc = vec3.normalize(vec3.diff(b,c))
          if (vec3.dot(u_ab,u_bc)<0) {
            var u_extra = vec3.normalize(vec3.plus(u_ab,u_bc))
            circle = x3d.nextCircle(prevCircle,rA,u_ab,b,rB,u_extra)
            circles.push(circle)
            prevCircle = circle
            rA = rB
            u_ab = u_extra
          }
        } else {
          u_bc = u_ab
        }
        circle = x3d.nextCircle(prevCircle,rA,u_ab,b,rB,u_bc)
        var corrCircle = []
        for (var j=0; j<circle.length; j++) {
          if (vec3.dot( vec3.diff(prevCircle[j],circle[j]),u_ab ) < 0) {
            corrCircle.push(prevCircle[j])
          } else {
            corrCircle.push(circle[j])
          }
        }
        circles.push(corrCircle)
        rA = rB
        u_ab = u_bc
        b = c
        rB = rC
        prevCircle = circle
      }

      var coords = []
      var indices = []
      var circle = circles[0]
      var len = circle.length
      coords.push(circle.map(function(a) { return a.join(' ') }).join(' '))
      for (var i=len-1; i>=0; i--) {
        indices.push(i)
      }
      indices.push(-1)
      var offset = len;
      for (var c=1; c<circles.length; c++) {
        circle = circles[c]
        len = circle.length
        coords.push(circle.map(function(a) { return a.join(' ') }).join(' '))
        if (c==circles.length-1) {
          for (var i=0; i<len; i++) {
            indices.push(offset+i)
          }
          indices.push(-1)
        } 
        for (var i=0;i<len-1;i++) {
          indices.push([offset-len+i+1,offset+i+1,offset+i,offset-len+i].join(' '))
          indices.push(-1)
        }
        indices.push([offset-len,offset,offset+len-1,offset-1].join(' '))
        indices.push(-1)
        offset += len
      }
      xml.push('<Shape>')
      xml.push('<Appearance><Material diffuseColor="'+color+'" specularColor="1 1 1"></Material>')
      xml.push('</Appearance>')
      xml.push('<IndexedFaceSet creaseAngle="'+(renderMode == 'cones_smooth' ? '0.1' : '0')+'" colorPerVertex="false" coordIndex="'+indices.join(' ')+'" solid="true">')
      xml.push('<Coordinate point="'+coords.join(' ')+'"></Coordinate>')
      xml.push('</IndexedFaceSet>')
      xml.push('</Shape>')
    }
  }
  xml.push('</Group>')
  return xml.join('\n')
}

viewer_class.prototype.meshXML = function(meshId,vertices_csv,faces_csv) {
  var xml = []
  xml.push('<Shape id="'+meshId+'">')
  xml.push('<IndexedFaceSet creaseAngle="0.785" solid="true" colorPerVertex="false" normalPerVertex="false" coordIndex="'+faces_csv.split('\n').join(' -1\n')+'">')
  xml.push('  <Coordinate point="'+vertices_csv+'"/>')
  xml.push('</IndexedFaceSet>')
  xml.push('<Appearance alphaClipThreshold="0.05"><Material diffuseColor="0.439216 0.631373 1" transparency="0.94"/><DepthMode readOnly="true"></DepthMode></Appearance>')
  xml.push('</Shape>')
  return xml.join('\n')  
}

viewer_class.prototype.renderTree = function(nodeId,parentVisibility, xml) {
  if (!nodeId) {
    nodeId = 0
    xml = []
    parentVisibility = true
  }
  var node = this.nodeList.row(nodeId)
  var visibility = node[4] || parentVisibility // 0:inherit, 1:on, 9:off
  if (visibility === 1) {
    var lineId = node[0] // line number
    if (lineId) xml.push(this.lineXML(lineId))
  }
  
  var childId = node[3] // firstChild
  if (childId) {
    while (childId < this.nodeList.nR && this.nodeList.row(childId)[2] == nodeId) { // while child's parent is current node
      this.renderTree(childId,visibility, xml)
      childId += 1
    }
  }
  
  // render previously selected slices here?
  
  return xml.join('\n')
}

viewer_class.prototype.renderImage = function(imgStack,i,transformations) {
  if (transformations) {
    var tf = transformations[0]
    var samples = assertArray(tf.sample)
    if (samples.length != 2) throw('Invalid number of samples')
    var img = imgStack.image[i]
    var bottom0 = imgStack.pixHeight-samples[0].top
    var bottom1 = imgStack.pixHeight-samples[1].top
    var a11 = (1.0*samples[1].x-samples[0].x)/(samples[1].left-samples[0].left)
    var a22 = (1.0*samples[1].y-samples[0].y)/(bottom1-bottom0)
    var b1 = samples[0].x-a11*samples[0].left
    var b2 = samples[0].y-a22*bottom0
    var AbT = [
      [a11,0,0],
      [0,0,0],
      [0,0,a22],
      [b1,parseFloat(img.z),b2]
    ]
  }
  var url = img.url
  if (url.charAt(0) == '.' && imgStack.__atlasUrl__) {
    var atlasUrl = (imgStack.__atlasUrl__).split('/')
    atlasUrl.pop()
    url = atlasUrl.join('/')+url.substr(1)
  }
  var xml = (
    '<MatrixTransform matrix="'+AbT[0].join(' ')+' 0 '+AbT[1].join(' ')+' 0 '+AbT[2].join(' ')+' 0 '+AbT[3].join(' ')+' 1">'+
    '<Shape>'+
    '  <IndexedFaceSet solid="false" coordIndex="0 1 2 3">'+
    '    <Coordinate point="'+imgStack.pixWidth+' 0 '+imgStack.pixHeight+' 0 0 '+imgStack.pixHeight+' 0 0 0 '+imgStack.pixWidth+' 0 0"/>'+
    '  </IndexedFaceSet>'+
    '  <Appearance>'+
    '    <ImageTexture repeatS="false" repeatT="false" scale="false" url="'+url+'"/>'+
    '  </Appearance>'+
    '</Shape>'+
    '</MatrixTransform>'
  )
  return xml
}

viewer_class.prototype.renderSlice = function(sliceAxis,sliceCoord) {
  // depending on the srs, download an atlas json file
  var atlasSpec
  if (this.tree.srs == 'FP07-bregma') {
    atlasSpec = {
      slices: [
        { id:38, y:-0.82, img:"./FP07/Mouse_Brain_Atlas_37.jpg", 
          pixWidth:940, pixHeight:723, 
          samples: [[105,723-630,4,6],[832,723-84,-4,0]]
        },
        { id:42, y:-1.34, img:"./FP07/Mouse_Brain_Atlas_41.jpg", 
          pixWidth:940, pixHeight:723, 
          samples: [[105,723-630,4,6],[832,723-84,-4,0]]
        },
        { id:46, y:-1.82, img:"./FP07/Mouse_Brain_Atlas_45.jpg", 
          pixWidth:940, pixHeight:723, 
          samples: [[105,723-630,4,6],[832,723-84,-4,0]],
        },
        { id:50, y:-2.30, img:"./FP07/Mouse_Brain_Atlas_49.jpg", 
          pixWidth:940, pixHeight:723, 
          samples: [[105,723-630,4,6],[832,723-84,-4,0]],
        },
        { id:54, y:-2.80, img:"./FP07/Mouse_Brain_Atlas_53.jpg", 
          pixWidth:940, pixHeight:723, 
          samples: [[105,723-630,4,6],[832,723-84,-4,0]],
        },
        { id:58, y:-3.28, img:"./FP07/Mouse_Brain_Atlas_57.jpg", 
          pixWidth:940, pixHeight:723, 
          samples: [[105,723-630,4,6],[832,723-84,-4,0]],
        },
        { id:62, y:-3.80, img:"./FP07/Mouse_Brain_Atlas_61.jpg", 
          pixWidth:940, pixHeight:723, 
          samples: [[105,723-630,4,6],[832,723-84,-4,0]],
        },
        { id:66, y:-4.24, img:"./FP07/Mouse_Brain_Atlas_65.jpg", 
          pixWidth:940, pixHeight:723, 
          samples: [[105,723-630,4,6],[832,723-84,-4,0]],
        },
      ]
    }
  }
  if (atlasSpec) {
    var nearestSlice, smallestDist
    for (var i=0; i<atlasSpec.slices.length; i++) {
      var slice = atlasSpec.slices[i]
      if (slice[sliceAxis] !== undefined) {
        var dist = Math.abs(slice[sliceAxis]-sliceCoord)
        if (smallestDist === undefined || smallestDist>dist) {
          smallestDist = dist
          nearestSlice = slice
        }
      }
      console.log('The nearest slice is '+JSON.stringify(nearestSlice)) 
    }
    var AbT = nearestSlice.AbT
    if (!AbT) {
      var samples = nearestSlice.samples
      if (samples) {
        var a11 = (1.0*samples[1][2]-samples[0][2])/(samples[1][0]-samples[0][0])
        var a22 = (1.0*samples[1][3]-samples[0][3])/(samples[1][1]-samples[0][1])
        var b1 = samples[0][2]-a11*samples[0][0]
        var b2 = samples[0][3]-a22*samples[0][1] 
        AbT = [
          [a11,0,0],
          [0,0,0],
          [0,0,a22],
          [b1,nearestSlice.y,b2],
        ]
      }
    }
    var xml = (
      '<MatrixTransform matrix="'+AbT[0].join(' ')+' 0 '+AbT[1].join(' ')+' 0 '+AbT[2].join(' ')+' 0 '+AbT[3].join(' ')+' 1">'+
      '<Shape>'+
      '  <IndexedFaceSet solid="false" coordIndex="0 1 2 3">'+
      '    <Coordinate point="'+nearestSlice.pixWidth+' 0 '+nearestSlice.pixHeight+' 0 0 '+nearestSlice.pixHeight+' 0 0 0 '+nearestSlice.pixWidth+' 0 0"/>'+
      '  </IndexedFaceSet>'+
      '  <Appearance>'+
      '    <ImageTexture repeatS="false" repeatT="false" scale="false" url="'+nearestSlice.img+'"/>'+
      '  </Appearance>'+
      '</Shape>'+
      '</MatrixTransform>'
    )
    return xml
  } else {
    console.log('No slice for srs '+this.tree.srs)
    return ''
  }
}

viewer_class.prototype.addLineData = function(xyz, line) {
  var points = this.tree.points
  var lines = this.tree.lines
  var tp = line[0] // type
  var firstPoint = line[1] // first point
  var numPoints = line[2] // line length
  var p = line[3] // parent line
  var attrs = this.tree.typeMap[tp]
  var swcType = attrs.__type__
  var geom = attrs.geometry
  
  var x3dSettings = (this.x3dSettings || {})
  var color = ('0 0 0')
  if (swcType == 'soma') color = (x3dSettings.somaColor || '0 0.9 0')
  if (swcType == 'axon') color = (x3dSettings.axonColor || '0 0 1')
  if (swcType == 'dendrite') color = (x3dSettings.dendriteColor || '1 0 0')
  if (swcType == 'apical') color = (x3dSettings.apicalColor || '0.5 0 0')
  if (geom == 'marker') color = (x3dSettings.markerColor || '0 0 0')

  var rgb = color
  if (rgb.substr(0,1) != '#') {
    rgb = color.split(' ')
    rgb = [Math.floor(rgb[0]*255),Math.floor(rgb[1]*255),Math.floor(rgb[2]*255)]
    rgb = 'rgb('+rgb.join(',')+')'
  }

  // geometries are lines
  if (geom == 'tree' && p) {
    var p_line = lines.row(p)
    var p_firstPoint = p_line[1]
    var p_numPoints = p_line[2]
    var p_lastPoint = p_firstPoint+p_numPoints-1
    var p_pt = points.row(p_lastPoint)
    xyz[0].push(p_pt[0])
    xyz[1].push(p_pt[1])
    xyz[2].push(p_pt[2])
    xyz[3].push(rgb)
    xyz[4].push(p_lastPoint)
  }
  var closed = (geom=='contour')
  var w = 0
  for (var i=firstPoint; i<firstPoint+numPoints; i++) {
    var pt = points.row(i)
    xyz[0].push(pt[0])
    xyz[1].push(pt[1])
    xyz[2].push(pt[2])
    xyz[3].push(rgb)
    xyz[4].push(i)
    w += pt[3]*2 // radius => diameter
  }
  w /= numPoints
  xyz[0].push(null)
  xyz[1].push(null)
  xyz[2].push(null)
  xyz[3].push(null)
  xyz[4].push(null)
}

viewer_class.prototype.getPlotlyData = function(geoms, nodeId,parentVisibility, xyzc) {
  if (!geoms) geoms = ['tree','contour']
  if (!nodeId) {
    nodeId = 0
    xyzc = [[],[],[],[],[]]
    parentVisibility = true
  }
  var node = this.nodeList.row(nodeId)
  var visibility = node[4] || parentVisibility // 0:inherit, 1:on, 9:off
  if (visibility === 1) {
    var lineId = node[0] // line number
    if (lineId) {
      var lines = this.tree.lines
      var line = lines.row(lineId)
      var tp = line[0]
      var attrs = this.tree.typeMap[tp]
      var geom = attrs.geometry
      if (geoms.indexOf(geom) > -1) {
        this.addLineData(xyzc, line)
      }
    }
  }
  
  var childId = node[3] // firstChild
  if (childId) {
    while (childId < this.nodeList.nR && this.nodeList.row(childId)[2] == nodeId) { // while child's parent is current node
      this.getPlotlyData(geoms,childId,visibility, xyzc)
      childId += 1
    }
  }
  if (nodeId == 0) return xyzc
}

var x3d = {
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
    var circle = util.cloneArray(x3d.circle24)
    for (var i=0;i<circle.length;i++) {
      circle[i] = vec3.rotateAboutOrigin(radius*circle[i][0],yLevel,radius*circle[i][1],u,v,w,sinTheta,cosTheta)
    }
    return circle
  },
  startCircle: function(a,rA,u_ab) {
    var xu = vec3.cross010(u_ab)
    var sinTheta = vec3.norm(xu)
    if (sinTheta > 1e-8) xu = vec3.scale(xu,1.0/sinTheta)
    else xu = [1,0,0] 
    var cosTheta = u_ab[1] // cos(theta) of u_ab with 0,1,0
    var rc = x3d.originRotatedCircle(rA,0,xu[0],xu[1],xu[2],-sinTheta,cosTheta)
    for (var i=0; i<rc.length; i++) {
      rc[i] = vec3.plus(rc[i],a)
    }
    return rc
  },
  nextCircle: function(circleA,rA,u_ab,b,rB,u_bc) {
    var u_ac = vec3.normalize(vec3.plus(u_ab,u_bc))
    var denom = vec3.dot(u_ab,u_ac)
    if (denom == 0) denom = 1
    var circleB = []
    for (var i=0; i<circleA.length; i++) {
      var a_i = circleA[i];
      var t = vec3.dot(vec3.diff(a_i,b),u_ac)/denom
      var b_i = vec3.plus(a_i,vec3.scale(u_ab,t))
      if (rB != rA && rA>0) b_i = vec3.plus(b,vec3.scale(vec3.diff(b,b_i),rB/rA))
      circleB.push(b_i)
    }
    return circleB
  }
  /* NOT USED
  circleIndices: function(len) {
    var ci = []
    var half = len/2
    for (var i=0;i<half-1;i++) {
      ci.push([i,i+half,(i+half+1) % (len-1),i+1].join(' '))
    }
    ci.push([half-1,len-1,half,0].join(' '))
    return ci
  }
  */
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
  ajaxRequest({
    type:'GET',
    url:'https://services.humanbrainproject.eu/document/v0/api/file/'+hbpUuid,
    headers: {
      Authorization: 'Bearer ' + token
    },
    success: function(xhr) {
      var data = xhr.response
      try {
        data = JSON.parse(data)
        var fileName = data['_name'];
      } catch(err) {
        RuntimeError(err)
        var fileName = '???'
      }
      displayResult(false,fileName);
      ajaxRequest({
        type:'GET',
        url:'https://services.humanbrainproject.eu/document/v0/api/file/'+hbpUuid+'/content',
        headers: {
          Authorization: 'Bearer ' + token
        },
        success: function(xhr) {
          displayResult(xhr.response,fileName);
        }
      })
    }
  })
}