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

function runtimeError(msg,fatal) {
  var errorDiv = document.getElementById('RuntimeError');
  if (errorDiv) {
    if (msg) {
      errorDiv.innerHTML = msg;
      errorDiv.style.display = 'block';
    } else {
      errorDiv.style.display = 'none';
    }
  } else {
    console.log('RuntimeError: '+msg);
  }
  if (fatal) {
    console.error(msg);
    throw('RuntimeError: '+msg)
  }
}

function hideProgress() {
  const progressDiv = document.getElementById('ProgressBar');
  if (progressDiv) progressDiv.style.display = 'none';
}

function showProgress(msg,pct) {
  return new Promise((resolve, reject) => {
    const progressDiv = document.getElementById('ProgressBar');
    if (progressDiv) {
      progressDiv.innerHTML = (pct ? msg+' ('+pct+'%)' : msg);
      progressDiv.style.display = 'block';
    } else {
      console.log(msg,pct);
    }
    setTimeout(resolve,10);
  });
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

function handleLineClick(evt,lineElem) {
  evt = evt || window.event;
  evt.preventDefault();
  evt.stopPropagation();
  const coord_mm = evt.hitPnt;
  var lineId = lineElem.id.split('_')[1]
  var name = VIEWER.tree && VIEWER.tree.getLineName(lineId)

  const x3dElem = document.getElementById('X3D_ROOT');
  const pixPerCss = x3dElem.runtime.canvas.devicePixelRatio;
  const shapeMenu = new contextMenu_class([x3dElem,evt.layerX/pixPerCss+10,evt.layerY/pixPerCss+10]);
  shapeMenu.addRow().addCell(['<span>You clicked on line# '+lineId+'<br/>named \n"'+name+'"<br/>at coordinate '+coord_mm.map(x3d.formatSingle).join(',')+'</span>']);


/*
x3dNode_class.prototype.onclickShape = function(evt) {
  evt.preventDefault();
  evt.stopPropagation();
  const coord_mm = x3dUtil.toSFVec3f(evt.hitPnt);
  //this.dataCursor(this,coord_mm);  
  const tree = this.getTree();
  const getAcr = (rgb,lv) => { return rgb === undefined ? undefined : lv.rgb2acr[ rgb ]; } 
  const getFull = (acr) => { 
    if (acr === undefined) return undefined;
    const node = tree.id2node[safeEncode(acr)]; return node ? node.name : '?';
  } 

  const lv = tree.labelVolumes[0];
  function onclickRegion(acr) {
    const atlasNode = tree.id2node['__BRAIN_REGIONS__'];
    const regionNode = atlasNode.selectRegion(acr);
    if (regionNode) regionNode.set_render(true);
  }
  const x3dElem = document.getElementById('X3D-x3d');
  const pixPerCss = x3dElem.runtime.canvas.devicePixelRatio;
  
  const shapeMenu = new contextMenu_class([x3dElem,evt.layerX/pixPerCss+10,evt.layerY/pixPerCss+10]);
  shapeMenu.addRow();
  const cellTriplets = [
    'Object: ',['i',[this.id+': '+this.name.replace('<','&lt;')]],
    ['br'],'Touched at: ('+roundVec(evt.hitPnt,tree.spatialReferenceSystem.boundingBox).join(',')+')'
  ]
  
  if (lv) {
    const voxelData = lv.voxelData;
    const Q_mm2vox = voxelData.Q.inverse();
    const coord_vox = Q_mm2vox.multMatrixPnt(coord_mm);
    const ndArray = voxelData.ndArray; // new ndArray_class(voxelData.asArray(),voxelData.dims,voxelData.memoryLayout);
    // also try locations near clicked point, along surface normal.
    const surfNorm_mm = new x3dom.fields.SFVec3f(evt.normalX,evt.normalY,evt.normalZ);
    const surfNorm_vox = voxelData.Q.transpose().multMatrixPnt(surfNorm_mm).normalize();
    const labelIndex1 = ndArray.get([Math.round(coord_vox.x+0.5*surfNorm_vox.x),Math.round(coord_vox.y+0.5*surfNorm_vox.y),Math.round(coord_vox.z+0.5*surfNorm_vox.z)]);
    const acr1 = getAcr(lv.index2rgb[labelIndex1],lv);
    const full1 = getFull(acr1);
    let labelIndex2;
    const probes = [-0.5,-1.5,-2.5];
    for (let i=0; i<probes.length; i++) {
      const p = probes[i];
      labelIndex2 = ndArray.get([Math.round(coord_vox.x+p*surfNorm_vox.x),Math.round(coord_vox.y+p*surfNorm_vox.y),Math.round(coord_vox.z+p*surfNorm_vox.z)]);
      if (labelIndex2 !== labelIndex1) break;
    }
    if (labelIndex1 === undefined) { labelIndex1 = labelIndex2; labelIndex2 = undefined; }
    if (labelIndex1 !== labelIndex2 && labelIndex2 !== undefined) {
      const acr2 = lv.rgb2acr[ lv.index2rgb[labelIndex2] ];
      const full2 = getFull(acr2);
      cellTriplets.push(['br']);
      cellTriplets.push('near the interface between ');
      cellTriplets.push(['span',{ className:'a',onclick:(evt) => onclickRegion(acr1) },[acr1+': '+full1]]);
      cellTriplets.push(' and ');
      cellTriplets.push(['span',{ className:'a',onclick:(evt) => onclickRegion(acr2) },[acr2+': '+full2]]);
    } else if (labelIndex1 !== undefined) {
      cellTriplets.push(['br']);
      cellTriplets.push('At/near region ');
      cellTriplets.push(['span',{ className:'a',onclick:(evt) => onclickRegion(acr1) },[acr1+': '+full1]]);
    };
  }
  shapeMenu.addCell.apply(shapeMenu,cellTriplets);
}
*/
  //alert('You clicked on line# '+lineId+' named "'+name+'"');
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
  tree.runtimeError = runtimeError;
  VIEWER = this // global variable VIEWER used in callback functions
  this.id2group = ['']
  this.createNodeList()
  this.spatialRegistration = {
    atlases: {},
    transforms: {}
  }
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
  const node = this.nodeList.row(nodeId);
  const nodeElem = document.getElementById('node_'+nodeId);
  if (nodeElem) {
    nodeElem.checked = makeVisible
    var visibility = node[4]
    nodeElem.style.opacity = (visibility === 0 ? '0.5' : '1.0')
  }
  const lineId = node[0];
  if (lineId) {
    var xElem = document.getElementById('shape_'+lineId);
    if (xElem) { xElem.render = makeVisible; }
    else if (makeVisible) this.insertLine(lineId);
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
  const node = this.nodeList.row(nodeId);
  const inherit = this.inheritedVisibility(node[2]);
  let visibility = node[4];
  if (visibility === inherit || visibility === 0) visibility = 10-inherit; // 9 means explicitly do not render
  else visibility = 0;
  node[4] = visibility;
  this.showNode(nodeId,(visibility || inherit) === 1);
}

viewer_class.prototype.defaultGroupVisibility = {
  // 0: inherit, 1: show, 9: hide
  "contours": 9,
  "borders": 9,
  "markers": 9,
  "spines": 9,
  "images": 9
}

viewer_class.prototype.getNodeName = function(nodeId) {
  const node = this.nodeList.row(nodeId);
  if (node[0]) return this.tree.getLineName(node[0]);
  if (node[1]) return this.id2group[node[1]];
  return '?';
}

viewer_class.prototype.createChildNodes = function(nodeId) {
  // nodeList contains [0:lineId,1:groupId,2:parentId,3:firstChildId,4:visibility]
  const node = this.nodeList.row(nodeId)
  if (nodeId === 0 || node[0] > 0) { // if root or node contains a line
    const parentGroup = this.id2group[node[1]];
    const lineId = node[0];
    const groups = this.tree.getGroups(this.tree.children[lineId]);
    if (groups) {
      node[3] = this.nodeList.nR // set firstChild
      for (let g in groups) {
        const members = groups[g];
        const visibility = this.defaultGroupVisibility[g] || 0;
        if (members.length > 0 && g !== '' && g !== parentGroup) {
          const len = this.id2group.push(g);
          this.nodeList.pushRow([0,len-1,nodeId,0,visibility]);
        } else {
          var groupId = (g == parentGroup ? node[1] : this.id2group.push(g)-1);
          for (let i=0; i<members.length; i++) {
            const childId = members[i];
            this.nodeList.pushRow([childId,groupId,nodeId,0,visibility]);
          }
        }
      }
    }
  } else {
    const parentNode = this.nodeList.row(node[2]);
    const groups = this.tree.getGroups(this.tree.children[parentNode[0]]);
    const g = this.id2group[node[1]];
    if (g) {
      const members = groups[g];
      node[3] = this.nodeList.nR; // set firstChild
      for (var i=0; i<members.length; i++) {
        const childId = members[i];
        this.nodeList.pushRow([childId,node[1],nodeId,0,0]);
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
  const node = this.nodeList.row(nodeId);
  const lineId = node[0];
  let ans = '<ol class="node" style="display:block">';
  if (lineId) {
    const line = this.tree.lines.row(lineId);
    const tp = line[0];
    const firstPoint = line[1];
    const numPoints = line[2];
    const attrs = Object.assign({},this.tree.typeMap[tp]);
    const op = this.tree.objectProperties[firstPoint];
    if (op) for (let k in op) attrs[k] = op[k]; 
    if (attrs) {
      const toggleSwitch = '<span class="toggle" onclick="toggleShowHide(this,1)">'+toggleStatus.showHide.closed+'</span>';
      ans += '<li>Attributes ('+Object.keys(attrs).length+')&nbsp;'+toggleSwitch+'<div class="content-closed"><pre>'+JSON.stringify(attrs,null,2)+'</pre></li>';
    }
    const toggleSwitch = '<span class="toggle" onclick="toggleShowHide(this,1)">'+toggleStatus.showHide.closed+'</span>';
    ans += '<li>Points ('+numPoints+')&nbsp;'+toggleSwitch+'<div class="content-closed">';
    const points = this.tree.points;
    ans += '<pre>';
    for (let i=firstPoint; i<=firstPoint+numPoints-1; i++) {
      if (i>firstPoint) ans += '<br/>';
      const pt = points.row(i);
      ans += pt[0].toFixed(2)+' '+pt[1].toFixed(2)+' '+pt[2].toFixed(2)+' '+pt[3].toFixed(2);
    }
    ans += '</pre>';
    ans += '</div></li>';
  }

  //var firstChildId = this.createChildNodes(nodeId)
  let childId = node[3]; // firstChild
  if (childId) {
    const li = [];
    while (childId < this.nodeList.nR && this.nodeList.row(childId)[2] == nodeId) { // while child's parent is current node
      li.push(this.listingHtml('h3',childId));
      childId += 1;
    }
    ans += '<li>'+li.join('</li><li>')+'</li>';
  }
  ans += '</ol>';
  return nodeId ? '<div class="result">'+ans+'</div>' : ans;
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
  const line = this.tree.lines.row(lineId);
  const parentLineId = line[3];
  const parentElem = document.getElementById('X3D_MORPHOLOGY');
  if (parentElem) {
    var lineElem = document.createElementNS("http://www.web3d.org/specifications/x3d-3.3.xsd",'Group');
    // use Promise.all because lineX3D only returns a promise if data is not immediately available
    Promise.all([this.tree.lineX3D( lineId,this.x3dSettings,'handleLineClick',true)])
    .then ( (lineX3D) => {
      lineElem.innerHTML = lineX3D[0];
      parentElem.appendChild(lineElem);
    } );
  } else {
    runtimeError('X3D: Need root X3D element with id "X3D_SCENE".')
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

viewer_class.prototype.renderTree_recursive = function(nodeId,parentVisibility,groupOnclick, xml) {
  const node = this.nodeList.row(nodeId);
  const visibility = node[4] || parentVisibility; // 0:inherit, 1:on, 9:off
  if (visibility === 1) {
    const lineId = node[0]; // line number
    //if (lineId) xml.push(this.lineXML(lineId));
    if (lineId) xml.push( this.tree.lineX3D(lineId,this.x3dSettings,groupOnclick,true) );
  }
  
  let childId = node[3]; // firstChild
  if (childId) {
    while (childId < this.nodeList.nR && this.nodeList.row(childId)[2] == nodeId) { // while child's parent is current node
      this.renderTree_recursive(childId,visibility,groupOnclick, xml);
      childId += 1;
    }
  }
}  

viewer_class.prototype.renderTree = function(groupOnclick) {
  var nodeId = 0;
  const xml = [];
  const parentVisibility = true;

  this.renderTree_recursive(nodeId,parentVisibility,groupOnclick, xml);
  
  return Promise.all(xml);
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
        runtimeError(err)
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