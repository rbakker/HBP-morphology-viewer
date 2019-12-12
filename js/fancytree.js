function cssEscape(value) {
  if (window.CSS && window.CSS.escape) {
		return window.CSS.escape(value);
	} else {
		var string = String(value);
		var length = string.length;
		var index = -1;
		var codeUnit;
		var result = '';
		var firstCodeUnit = string.charCodeAt(0);
		while (++index < length) {
			codeUnit = string.charCodeAt(index);
			// Note: there’s no need to special-case astral symbols, surrogate
			// pairs, or lone surrogates.

			// If the character is NULL (U+0000), then the REPLACEMENT CHARACTER
			// (U+FFFD).
			if (codeUnit == 0x0000) {
				result += '\uFFFD';
				continue;
			}

			if (
				// If the character is in the range [\1-\1F] (U+0001 to U+001F) or is
				// U+007F, […]
				(codeUnit >= 0x0001 && codeUnit <= 0x001F) || codeUnit == 0x007F ||
				// If the character is the first character and is in the range [0-9]
				// (U+0030 to U+0039), […]
				(index == 0 && codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
				// If the character is the second character and is in the range [0-9]
				// (U+0030 to U+0039) and the first character is a `-` (U+002D), […]
				(index == 1 && codeUnit >= 0x0030 && codeUnit <= 0x0039 && firstCodeUnit == 0x002D)
			) {
				// https://drafts.csswg.org/cssom/#escape-a-character-as-code-point
				result += '\\' + codeUnit.toString(16) + ' ';
				continue;
			}

			if (
				// If the character is the first character and is a `-` (U+002D), and
				// there is no second character, […]
				index == 0 &&
				length == 1 &&
				codeUnit == 0x002D
			) {
				result += '\\' + string.charAt(index);
				continue;
			}

			// If the character is not handled by one of the above rules and is
			// greater than or equal to U+0080, is `-` (U+002D) or `_` (U+005F), or
			// is in one of the ranges [0-9] (U+0030 to U+0039), [A-Z] (U+0041 to
			// U+005A), or [a-z] (U+0061 to U+007A), […]
			if (
				codeUnit >= 0x0080 ||
				codeUnit == 0x002D ||
				codeUnit == 0x005F ||
				codeUnit >= 0x0030 && codeUnit <= 0x0039 ||
				codeUnit >= 0x0041 && codeUnit <= 0x005A ||
				codeUnit >= 0x0061 && codeUnit <= 0x007A
			) {
				// the character itself
				result += string.charAt(index);
				continue;
			}

			// Otherwise, the escaped character.
			// https://drafts.csswg.org/cssom/#escape-a-character
			result += '\\' + string.charAt(index);

		}
		return result;
	}
}

/* DOM ELEM */
function domElem_class(parentElem,widgets) {
  this.rootElem = parentElem;
  this.lastParent = this.lastElem = parentElem;
  this.widgets = widgets || {};
}

domElem_class.prototype.addElem = function(tagName,attrs,children) {
  if (!tagName) return this;
  const parent = this.lastParent;
  // special case: domElem_class instead of tagName
  if (tagName instanceof domElem_class) {
    parent.appendChild(tagName);
    return this;
  }
  // special case: html instead of tagName
  if (typeof tagName === 'string' && tagName.charAt(0) === '<') {
    parent.innerHTML = tagName;
    return this;
  }
  // each triplet must start with a tagName string (or dom-element), and may be followed by an attribute object and an array of child-triplets
  const elem = (tagName instanceof HTMLElement ? tagName : document.createElement(tagName));
  this.lastElem = parent.appendChild( elem )
  if (attrs) for (let k in attrs) elem[k] = attrs[k];
  this.lastParent = elem;
  if (children) {
    const myWidgets = [];
    for (let i=0; i<children.length; i++) {
      let triplet = children[i];
      if (triplet instanceof widget_class) {
        // replace widget-type arguments by corresponding triplets.
        const widget = triplet;
        myWidgets.push(widget);
        triplet = widget.getTriplet(this);
        // maintain widget lookup table
        this.widgets[widget.name] = widget;
      }
      if (triplet.constructor === String) {
        elem.appendChild( document.createTextNode(triplet) );
      } else if (triplet.constructor === Array) {
        let t,a,c,f;
        for (let j=0; j<triplet.length; j++) {
          const part = triplet[j];
          const tp = part.constructor
          if (tp === String) {
            t = part;
          }
          else if (tp === Object) a = part;
          else if (tp === Array) c = part;
        }
        this.addElem(t,a,c);
      }
    }
    // display widget value (after being added to the DOM)
    for (let i=0; i<myWidgets.length; i++) myWidgets[i].update();
  }
  this.lastParent = parent;
  return this;
}

domElem_class.prototype.getWidget = function(name) {
  return this.widgets[name];
}

domElem_class.prototype.setWidgetValue = function(name,value) {
  let widget = this.widgets[name];
  if (widget) {
    widget.setValue(value,this);
  } else {
    widget = this.rootElem.querySelector('[name="'+cssEscape(name)+'"]');
    if (widget.tagName.toLowerCase() == 'input') widget.value = value;
    if (widget.tagName.toLowerCase() == 'select') {
      for (let i=0; i<widget.options.length; i++) {
        const opt = widget.options[i];
        if (opt.value == value) { 
          widget.selectedIndex = i; 
          break;
        }
      }
    }
  }
}

domElem_class.prototype.getWidgetValue = function(name) {
  let widget = this.widgets[name];
  if (widget) {
    return widget.getValue();
  } else {
    widget = this.rootElem.querySelector('[name="'+cssEscape(name)+'"]');
    if (widget.tagName.toLowerCase() == 'input') return widget.value;
    if (widget.tagName.toLowerCase() == 'select') return widget.options[widget.selectedIndex].value;
  }
}

domElem_class.prototype.getWidgetValues = function(/* names */) {
  let result = Array(arguments.length);
  for (let i=0; i<arguments.length; i++) result[i] = this.getWidgetValue(arguments[i]);
  return result;
}

domElem_class.prototype.hide = function() {
  document.body.removeChild(this.rootElem);
}


/* DOM TABLE */
function domTable_class(table,widgets) {
  if (table) {
    domElem_class.apply(this,[table,widgets]);
    this.tableElem = table;
  }
}

domTable_class.prototype = new domElem_class();

domTable_class.prototype.addRow = function(/* before, attrs, cell1, cell2, ... */) {
  const tr = document.createElement('tr');
  let i0 = 0;
  const before = (arguments[i0] instanceof HTMLElement && arguments[i0]);
  if (before) {
    this.tableElem.insertBefore(tr,before);
    i0 += 1;
  } else {
    this.tableElem.appendChild(tr);
  }
  if (arguments[i0] && arguments[i0].constructor === Object) {
    const attrs = arguments[i0];
    for (let k in attrs) tr[k] = attrs[k];
    i0 += 1;
  }
  this.lastParent = tr;
  // additional arguments may contain cells with just a single argument
  for (let i=i0; i<arguments.length; i++) { this.addCell(arguments[i]) }
  return this;
}

domTable_class.prototype.addCell = function() {
  let attrs, children = arguments;
  // The first argument may contain cell attributes. Read and remove.
  if (children[0].constructor === Object) {
    attrs = children[0];
    children = Array.prototype.slice.call(arguments,[1]);
  }
  this.addElem('td',attrs,children);
  return this;
}

domTable_class.prototype.emptyTable = function() {
  this.tableElem.innerHTML = '';
  return this;
}


/* CONTEXT MENU */

function contextMenu_class(callerElem,title,parentMenu) {
  if (!callerElem) return;
  
  // positioning of the menu
  const body = document.body;
  const html = document.documentElement;
  let scrollTop = window.pageYOffset || html.scrollTop || body.scrollTop || 0;
  let scrollLeft = window.pageXOffset || html.scrollLeft || body.scrollLeft || 0;
  let menuLeft = 0, menuTop = 0;
  this.callerElem = callerElem instanceof Array ? callerElem[0] : callerElem;
  const box = this.callerElem.getBoundingClientRect();
  if (callerElem instanceof Array) {
    menuLeft = callerElem[1] + box.left + scrollLeft;
    menuTop = callerElem[2] + box.top + scrollTop;
  } else {
    const bottom = box.bottom + scrollTop;
    left = box.left + scrollLeft;
    menuLeft = (left+10);
    menuTop = (bottom-4);
  }
  
  // close context menu's before creating a new one.
  if (parentMenu) parentMenu.addChild(this);
  const menuList = contextMenu_class.prototype.menuList;
  for (let i=0; i<menuList.length; i++) {
    const menu = menuList[i];
    if (menu.autoHide && !menu.childList.length) menu.hide();
  }
  this.parentMenu = parentMenu;
  this.childList = [];
  menuList.push(this);

  const div = document.createElement('div');
  div.className = 'menuWindow';
  div.setAttribute('tabindex', '0');
  div.onkeydown = (evt) => { if (evt.key === 'Escape') this.hide() };

//  // positioning of the menu
//  const body = document.body;
//  const html = document.documentElement;
//  let scrollTop = window.pageYOffset || html.scrollTop || body.scrollTop || 0;
//  let scrollLeft = window.pageXOffset || html.scrollLeft || body.scrollLeft || 0;
//  let menuLeft = 0, menuTop = 0;
//  const box = this.callerElem.getBoundingClientRect();
  div.style.left = ''+menuLeft+'px';
  div.style.top = ''+menuTop+'px';

  if (title) {
    let mousePosStart;
    let mousePosEnd;
    div.draggable = false;
    div.ondragstart = (evt) => {
      evt = evt || window.event;
      this.autoHide = false;
      evt.dataTransfer.setData('text',''); 
      document.ondragover = (e) => {
        e = e || window.event;
        e.preventDefault();
        mousePosEnd = [e.pageX, e.pageY];
      }
    }
    div.ondragend = (evt) => {
      evt = evt || window.event;
      evt.preventDefault();
      menuLeft += mousePosEnd[0]-mousePosStart[0];
      menuTop += mousePosEnd[1]-mousePosStart[1];
      div.style.left = ''+menuLeft+'px';
      div.style.top = ''+menuTop+'px';
      div.draggable = false;
      document.ondragover = undefined;
    }
    div.onmousemove = undefined;
    div.onmouseenter = undefined;
    div.onmouseleave = undefined;
    
    let bar = document.createElement('div');
      bar.onmousedown = (evt) => { 
        evt = evt || window.event;
        mousePosStart = [evt.pageX, evt.pageY];
        mousePosEnd = [evt.pageX, evt.pageY];
        div.draggable = true;
      }
      bar.onmouseup = () => { div.draggable = false; }
      bar.style.height = '1ex';
      bar.style.padding = '1ex';
      bar.style.borderTopLeftRadius = '1ex';
      bar.style.borderTopRightRadius = '1ex';
      bar.style.textAlign = 'center';
      bar.style.color = '#FFF';
      bar.style.background = 'linear-gradient(#888, #444 100%)';
      const b = document.createElement('b')
      b.innerHTML = title;
      b.style.position = 'relative';
      b.style.top = '-0.5ex';
      bar.appendChild( b );
      const hide = document.createElement('b');
        hide.style = (
          'position: relative;'+
          'float: right;'+
          'height: 2ex;'+
          'top: -0.5ex'
        )
        hide.innerHTML = '&nbsp;&#x274C;';
        hide.onclick = () => { this.hide() }
      bar.appendChild( hide );
    div.appendChild(bar);
  } else {
    let mouseOutside = true;
    this.contextMenuOnmousemove = () => {
      if (mouseOutside && !this.contextMenuTimeout) {
        this.contextMenuTimeout = setTimeout(() => {
          if (this.autoHide && !this.childList.length) this.hide();
        }, 500)
      }
    }
    this.callerElem.addEventListener('mousemove',this.contextMenuOnmousemove,false);
    div.onmouseleave = () => { 
      mouseOutside = true;
      this.contextMenuOnmousemove();
    }
    div.onmouseenter = () => { 
      mouseOutside = false;
      clearTimeout(this.contextMenuTimeout);
      this.contextMenuTimeout = undefined;
    }
  }

  // menu content: table
  const innerDiv = document.createElement('div')
  innerDiv.style = 'padding: 1ex';
  const table = document.createElement('table')
  innerDiv.appendChild(table);
  div.appendChild(innerDiv);
  div.style.display = 'block';
  body.appendChild(div)
  div.focus();

  domTable_class.apply(this,[table]);

  this.menuElem = div;
  this.data = {};
}

contextMenu_class.prototype = new domTable_class();
contextMenu_class.prototype.menuList = [];
contextMenu_class.prototype.autoHide = true;

contextMenu_class.prototype.addChild = function(childMenu) {
  this.childList.push(childMenu);
}

contextMenu_class.prototype.delChild = function(child) {
  const i = this.childList.indexOf(child);
  const last = this.childList.pop()
  if (this.childList.length > i) this.childList[i] = last;
}

contextMenu_class.prototype.onhide = function() {
  // overwrite
}

contextMenu_class.prototype.hide = function() {
  const menuList = contextMenu_class.prototype.menuList;
  const i = menuList.indexOf(this);
  if (i > -1) {
    if (this.menuElem) document.body.removeChild(this.menuElem);
    const last = menuList.pop();
    if (menuList.length > i) menuList[i] = last;
    if (this.contextMenuTimeout) clearTimeout(this.contextMenuTimeout);
    if (this.contextMenuOnmousemove) this.callerElem.removeEventListener('mousemove',this.contextMenuOnmousemove,false); 
  }
  for (let i=0; i<this.childList.length; i++) this.childList[i].hide();
  this.onhide();
  if (this.parentMenu) this.parentMenu.delChild(this);
}

contextMenu_class.prototype.previewChange = function(name,value,evt) {
  if (this['preview_'+name]) this['preview_'+name](value,evt);
  else this.applyChange(name,value,evt);
}

contextMenu_class.prototype.applyChange = function(name,value,evt) {
  if (this['set_'+name]) this['set_'+name](value,evt);
  else console.log('Menu does not have method "'+'set_'+name+'"');
}

contextMenu_class.prototype.store = function(name,value) {
  this.data[name] = JSON.stringify(value);
}

contextMenu_class.prototype.retrieve = function(name) {
  return JSON.parse(this.data[name]);
}

// CLASS widget

function widget_class(name,value) {
  if (!name) return;
  this.name = name;
  this.value = value;
}
widget_class.prototype.menu = false; // menu is accessible after calling getTriplet()

// update the display of the widget
widget_class.prototype.update = function() {
  /* overwrite */
}

// return either:
//   [true + accepted value]
//   [false + error message]
widget_class.prototype.validate = function(value) {
  return [true,value];
}

// display an error message
widget_class.prototype.error = function(msg) {
  console.log(msg);
}

// return the html-triplet to display the widget
widget_class.prototype.triplet = function() {
  /* overwrite */
}

// get the value of the widget
widget_class.prototype.getValue = function() { 
  return this.value;
}

// set a new value of the widget
widget_class.prototype.setValue = function(value) {
  this.value = value;
  this.update();
}

// change the value of the widget and propagate to menu
widget_class.prototype.applyChange = function(value,evt) {
  const [ok,v] = this.validate(value);
  if (ok) {
    this.setValue(v);
    this.menu.applyChange(this.name,this.value,evt || window.event);
  } else {
    this.error(v);
  }
}

// register the widget and return the html-triplet to display it 
widget_class.prototype.getTriplet = function(menu) {
  this.menu = menu;
  //menu.addWidget(this);
  return this.triplet();
}


// CLASS inputWidget
function inputWidget_class(name,value,type,style) {
  widget_class.apply(this,[name,value]);
  this.type = type || 'text';
  this.style = style;
}
inputWidget_class.prototype = new widget_class();

// update the display of the widget
inputWidget_class.prototype.update = function() {
  const field = this.menu.rootElem.querySelector('[name="'+cssEscape(this.name)+'"]');
  if (field) field.value = this.value;
}

inputWidget_class.prototype.triplet = function() {
  const widget = this;
  const attrs = { type:this.type, name:this.name, onchange: function(evt) { widget.applyChange(this.value,evt || window.event); } };
  if (this.style) attrs.style = this.style;
  return [ 'input', attrs ];
}

// CLASS numberWidget
function numberWidget_class(name,value,style,min,max,specialCases) {
  inputWidget_class.apply(this,[name,value,'text',style]);
  this.min = min;
  this.max = max;
  this.specialCases = specialCases || [];
}
numberWidget_class.prototype = new inputWidget_class();

numberWidget_class.prototype.validate = function(value) {
  if (this.specialCases.indexOf(value) > -1) return [true,value];
  value = parseFloat(value);
  if (parseFloat(value) === NaN) return [false,'Value "'+value+'" is not a number.']
  if (this.min !== undefined && value < this.min) value = this.min;
  if (this.max !== undefined && value > this.max) value = this.max;
  return [true,value];
}

// CLASS selectWidget
function selectWidget_class(name,value,choices,placeholder) {
  widget_class.apply(this,[name,value]),
  this.choices = choices;
  this.placeholder = placeholder;
}
selectWidget_class.prototype = new widget_class();

selectWidget_class.prototype.update = function() {
  const field = this.menu.rootElem.querySelector('[name="'+cssEscape(this.name)+'"]');
  const opts = field.options;
  for (let i=0; i<opts.length; i++) {
    if (opts[i].value == this.value) { opts[i].selected = true; break; }
  }
}

selectWidget_class.prototype.triplet = function() {
  const widget = this;
  const opts = [];
  if (this.placeholder) opts.push( ['option', { disabled: true }, [ this.placeholder ]] );
  for (var k in this.choices) {
    const attrs = { value: k };
    if (k === this.value) attrs.selected = true;
    opts.push( ['option', attrs, [ this.choices[k] ]] );
  }
  return [
    'select',
    { name: this.name, onchange: function(evt) {
      const v = this.options[this.options.selectedIndex].value;
      widget.setValue(v);
      widget.menu.applyChange(widget.name,v,evt || window.event);
    } },
    opts
  ];
}


// CLASS checkboxWidget
function checkboxWidget_class(name,checked,style) {
  inputWidget_class.apply(this,[name,'on','checkbox',style]);
  this.value = checked;
}
checkboxWidget_class.prototype = new inputWidget_class();

/*
// set a new value of the widget
checkboxWidget_class.prototype.setValue = function(value) {
  this.value = value && true;
  this.update();
}
*/

// update the display of the widget
checkboxWidget_class.prototype.update = function() {
  const field = this.menu.rootElem.querySelector('[name="'+cssEscape(this.name)+'"]');
  if (field) {
    field.setAttribute('checked',this.value);
  }
}

checkboxWidget_class.prototype.triplet = function() {
  const [tag,attrs] = inputWidget_class.prototype.triplet.apply(this);
  attrs.onchange = (evt) => { this.applyChange(evt.target.checked,evt); }
  attrs.checked = this.value;
  return [ tag, attrs ];
}


// CLASS rangeWidget

function rangeWidget_class(name,value,min,max,step,nonlinear) {
  widget_class.apply(this,[name,value])
  this.min = min;
  this.max = max;
  this.step = step;
  this.logarithmic = (nonlinear === 'log10');
  this.acos = (nonlinear === 'acos');
}
rangeWidget_class.prototype = new widget_class();

rangeWidget_class.prototype.update = function() {
  let v = this.value;
  const fields = this.menu.rootElem.querySelectorAll('[name="'+cssEscape(this.name)+'"]');
  const textField = fields[1];
  //this.menu.formElem[this.name][1]; 
  textField.value = v;
  const rangeField = fields[0];
  if (this.logarithmic) v = Math.log10(Math.max(v,this.min));
  if (this.acos) v = Math.acos(-v);
  rangeField.value = v;
}

rangeWidget_class.prototype.triplet = function() {
  const widget = this;
  let sliderMin = this.min;
  let sliderMax = this.max;
  let sliderStep = this.step;
  let sliderValue = this.value;
  if (this.logarithmic) {
    sliderMin = Math.log10(sliderMin);
    sliderMax = Math.log10(sliderMax);
    sliderStep = Math.log10(1+sliderStep);
    sliderValue = Math.log10(sliderValue);
  } else if (this.acos) {
    sliderMin = Math.acos(-sliderMin);
    sliderMax = Math.acos(-sliderMax);
    sliderStep *= Math.PI-1e-8;
    sliderValue = Math.acos(-sliderValue);
  }
  const rangeTriplet = [ 
    'input',
    {
      name: this.name,
      type: 'range',
      style: 'display: inline-block; verticalAlign: middle',
      min: sliderMin,      
      max: sliderMax,
      step: sliderStep,
      value: sliderValue,      
      oninput: function() {
        let v = parseFloat(this.value);
        if (widget.logarithmic) v = Math.pow(10,v);
        if (widget.acos) v = -Math.cos(v);
        widget.setValue(v);
        widget.menu.previewChange(widget.name,v);
      },
      onchange: function() {
        const v = widget.getValue();
        widget.menu.applyChange(widget.name,v);
      }
    }
  ];
  const prevTriplet = [
    'input',
    { 
      type: 'button', style: 'width: 4ex', value: '<', onclick: () => {
        const step = widget.step;
        let v = widget.getValue();
        if (widget.logarithmic) {
          let w = Math.log10(v) - sliderStep;
          if (w < sliderMin) w = sliderMin;
          v = Math.pow(10,w);
        } else if (widget.acos) {
          let w = Math.acos(-v) - sliderStep;
          if (w < sliderMin) w = sliderMin;
          v = -Math.cos(w);
          //if (v<widget.min) v = widget.min;
        } else {
          v -= step;
          if (v<widget.min) v = widget.min;
        }
        widget.setValue(v);
        widget.menu.applyChange(widget.name,v);
      }
    }
  ];
  const nextTriplet = [
    'input',
    {
      type: 'button', style: 'width: 4ex', value: '>', onclick: () => {
        const step = widget.step;
        let v = widget.getValue();
        if (widget.logarithmic) {
          let w = Math.log10(v) + sliderStep;
          if (w > sliderMax) w = sliderMax;
          v = Math.pow(10,w);
        } else if (widget.acos) {
          let w = Math.acos(-v) + sliderStep;
          if (w > sliderMax) w = sliderMax;
          v = -Math.cos(w);
        } else {
          v += step;
          if (v>widget.max) v = widget.max;
        }
        widget.setValue(v);
        widget.menu.applyChange(widget.name,v);
      }
    }
  ];
  const textTriplet = [
    'input',
    {
      type: 'text', style: 'width: 8ex', name: this.name, value: this.value, onchange: function() {
        const v = parseFloat(this.value);
        widget.setValue(v);
        widget.menu.applyChange(widget.name,v);
      }
    }
  ];
  return ['div',{className:'rangeWidget'},[rangeTriplet,prevTriplet,textTriplet,nextTriplet]];
}

rangeWidget_class.prototype.setLimits = function(min,max,step) {
  const rangeField = this.menu.rootElem.querySelector('[name="'+cssEscape(this.name)+'"]')
  //this.menu.formElem[this.name][0];
  rangeField.min = min;
  rangeField.max = max;
  rangeField.step = step;
}


/* MODAL TABLE */

function modalTable(msg) {
  const table = document.createElement('table');
  table.style = 'box-sizing: border-box; position: fixed; top: 25%; left: 50%; max-width: 96%; transform: translate(-50%, -50%); padding: 3em; border: 1em solid #888; border-radius: 3em; background: #DDDDFF; text-align: center; white-space: nowrap; z-index: 999';
  if (msg) table.innerHTML = msg;
  document.body.appendChild(table);
  return new domTable_class(table);
}


/* PROGRESS BAR */
function progressBar_class(dialogElem,title) {
  contextMenu_class.apply(this,[dialogElem,title]);
}

progressBar_class.prototype = new contextMenu_class();

progressBar_class.prototype.log = function(msg,replace) {
  return new Promise( (resolve,reject) => {
    if (replace) this.lastParent.lastChild.innerHTML = msg;
    else this.addRow(msg);
    setTimeout(resolve,50);
  } );
}


/* BASE TREE */

function fancyTree_class() {
  this.id2node = {};
}

fancyTree_class.prototype = {
  getNode: function(id) {
    return this.id2node[id];
  },
  uniqueId: function(id) {
    let uid = id;
    if (uid in this.id2node) {
      let i;
      for (i=1; i<1000; i++) {
        uid = id+' ('+i+')';
        if (!this.id2node[uid]) break;
      }
      if (i>=1000) throw('tree,makeUnique: id '+id+' already in use more than a thousand times');
    }
    return uid;
  },
  createNodeOnce: function(nodeClass,id, ...args) {
    if (this.id2node[id]) throw('Node with id '+node.id+' already exists.');
    const node = new nodeClass(id, ...args);
    this.id2node[node.id] = node;
    return node;
  },
  createNode: function(nodeClass,proposedId, ...args) {
    const id = this.uniqueId(proposedId);
    const node = new nodeClass(id,...args);
    this.id2node[node.id] = node;
    return node;
  },
  /*
  addNode: function(node,parent,ifexists) {
    parent = typeof parent === 'string' ? this.id2node[parent] : parent;
    if (!parent) throw('tree.addNode(): parent must be a registered node.')
    parent.appendChild(node);
    parent.redisplay();
  },
  */
  delNode_recursive: function(node) {
    // first delete children
    const ch = node.children || [];
    for (let i=0; i<ch.length; i++) this.delNode_recursive(ch[i]);
    // remove node from id2node
    if (this.id2node[node.id]) delete this.id2node[node.id];
  },
  delNode: function(node) {
    this.delNode_recursive(node);
    if (node.parent) {
      node.parent.removeChild(node);
      node.parent.redisplay();
    }
  }
}

/* BASE NODE */

function node_class(id,name) {
  if (id === undefined) return;
  this.id = id;    
  this.name = name;
}

node_class.prototype.expanded = false;
node_class.prototype.parent = undefined;
node_class.prototype.sortBy = undefined;
node_class.prototype.children = [];

node_class.prototype.fullName = function() {
  return this.id === this.name ? this.id : this.id+': '+this.name;
}

node_class.prototype.getTree = function() {
  if (this.tree) return this.tree;
  parent = this.parent;
  while (parent) {
    if (parent.tree) return parent.tree;
    parent = parent.parent;
  }
  return undefined;
}

/* to be called by tree.addNode */
node_class.prototype.appendChild = function(node,redisplay) {
  if (!this.hasOwnProperty('children')) this.children = [];
  if (node.parent) {
    console.log('Error adding child "'+node.fullName()+'" to "'+this.fullName()+'". It already has parent "'+node.parent.fullName()+'".');
  } else {
    node.parent = this;
    this.children.push(node);
    if (this.sortBy) {
      // sort the children
      const sortBy = this.sortBy
      this.children.sort(function(a, b) {
        if (a[sortBy] > b[sortBy]) {
          return 1;
        }
        if (a[sortBy] < b[sortBy]) {
          return -1;
        }
        return 0;
      })
    }
  }
}

/* to be called by tree.delNode */
node_class.prototype.removeChild = function(node) {
  const ch = this.children;
  const idx = ch.indexOf(node);
  if (idx>-1) {
    /* maintain order */
    for (let i=idx+1; i<ch.length; i++) {
      ch[i-1] = ch[i];
    }
    ch.pop();
  }
}

node_class.prototype.allChildren = function(childList) {
  if (!childList) childList = [];
  for (let k in this.children) {
    let ch = this.children[k];
    childList.push(ch);
    ch.allChildren(childList);
  }
  return childList;
}

node_class.prototype.initLevels = function(d) {
  this.level = d;
  let dMax = d;
  for (let k in this.children) {
    let ch = this.children[k];
    let deepest = ch.initLevels(d+1);
    if (deepest > dMax) dMax = deepest;
  }
  this.remainingLevels = dMax-d;
  return dMax;
}

node_class.prototype.getDisplayElem = function() {
  const elemId = 'TREE['+this.id+']';
  return document.getElementById(elemId);
}

node_class.prototype.setDisplayElem = function(elem) {
  /* storing elements by id prevents memory leaks in some browsers */
  elem.id = 'TREE['+this.id+']';
}

node_class.prototype.collapse = function(parentElem) {
  let childElems = parentElem.childNodes;
  for (var i=0; i<childElems.length; i++) {
    let ch = childElems[i];
    if (ch.className && ch.className.substr(0,5) == 'child') {
      parentElem.removeChild(ch);
      break;
    }
  }
}

node_class.prototype.childContainer = function(elem) {
  let div = document.createElement('div');
  div.className = 'children mod'+(this.level % 3);
  elem.appendChild(div);
  return div;
}

node_class.prototype.displayChildren = function(parentElem) {
  const elem = this.childContainer(parentElem);
  let ol = document.createElement('ol');
  ol.className = 'node';
  if (this.expanded === true) {
    for (let k in this.children) {
      const ch = this.children[k];
      let li = document.createElement('li');
      ch.display(li);
      ol.appendChild(li);
    }
  } else {
    const onlyThese = this.expanded;
    for (let i=0; i<onlyThese.length; i++) {
      const ch = onlyThese[i];
      let li = document.createElement('li');
      ch.display(li);
      ol.appendChild(li);
    }
  }
  elem.appendChild(ol);
}

node_class.prototype.toggle = function(toggleElem,doExpand) {
  let parentElem = toggleElem.parentNode;
  if (doExpand) {
    if (this.expanded) this.collapse(parentElem);
    this.expanded = true;
    this.displayChildren(parentElem);
  } else {
    this.expanded = false;
    this.collapse(parentElem);
  }
  this.toggleContent(toggleElem);
}

node_class.prototype.toggleContent = function(toggleElem) {
  toggleElem.innerHTML = '';
  const node = this;
  const halfExpanded = this.expanded instanceof Object && this.expanded.length < this.children.length;
  if (!this.expanded || halfExpanded) {
    const expandElem = document.createElement('span');
    expandElem.className = 'toggle';
    expandElem.onclick = function() { node.toggle(this.parentNode,true); }
    expandElem.innerHTML = (halfExpanded ? '&#177;' : '+'); // use plus-minus sign for half expanded
    toggleElem.appendChild(expandElem);
  }
  if (this.expanded && !halfExpanded) {
    const collapseElem = document.createElement('span');
    collapseElem.className = 'toggle';
    collapseElem.onclick = function() { node.toggle(this.parentNode,false); }
    collapseElem.innerHTML = '&#8211;';
    toggleElem.appendChild(collapseElem);
  }
}

node_class.prototype.tool_expandToggle = function(elem) {
  const toggleElem = document.createElement('div');
  toggleElem.className = 'toggle';
  if (this.children.length) {
    this.toggleContent(toggleElem);
  } else {
    toggleElem.className = 'toggle off'
  }
  elem.appendChild(toggleElem);
}

node_class.prototype.displayBefore = function(elem) {
  this.tool_expandToggle(elem);
}

node_class.prototype.displayValue = function(elem) {
  const spanElem = document.createElement('span');
  if (this.selected) spanElem.className += 'selected';
  spanElem.appendChild(document.createTextNode(this.name));
  const fullName = this.fullName();
  spanElem.onmouseover = () => { tooltip(spanElem,fullName) }
  spanElem.onmouseout = () => { tooltip(spanElem,false) }
  elem.appendChild(spanElem);
  return spanElem;
}

node_class.prototype.displayAfter = function(elem) {
}

node_class.prototype.display = function(elem) {
  this.setDisplayElem(elem);
  let me = this;
  
  this.displayBefore(elem);
  this.displayValue(elem);
  this.displayAfter(elem);
  
  if (this.children.length && this.expanded) {
    this.displayChildren(elem);
  }
}

node_class.prototype.redisplay = function() {
  const displayElem = this.getDisplayElem();
  if (displayElem) {
    displayElem.innerHTML = '';
    this.display(displayElem);
  }
}

node_class.prototype.select = function() {
  this.selected = true;
  let displayElem;
  let node = this;
  let parent = this.parent;
  while (parent) {
    displayElem = node.getDisplayElem();
    if (displayElem) break;
    if (typeof(parent.expanded) === 'object') parent.expanded.push(node)
    else parent.expanded = [node]
    node = parent;
    parent = node.parent;
  }
  if (parent) parent.redisplay();
}

node_class.prototype.deselect = function() {
  this.selected = undefined;
  this.redisplay();
}

node_class.prototype.tool_contextMenu = function(elem) {
  const menuElem = document.createElement('span');
  menuElem.className = 'contextMenu';
  menuElem.innerHTML = '&#9776;';
  const node = this;
  menuElem.onclick = function() { node.contextMenu(this); }
  elem.appendChild(menuElem);
  return menuElem;
}

node_class.prototype.menu_trash = function(menu) {
  // menu actions
  menu.set_trash = () => { 
    menu.hide(); 
    const tree = this.getTree();
    tree.delNode(this);
    if (this.x3dRemove) this.x3dRemove();
  }
  // menu layout
  menu.addRow()
  .addCell({colSpan:3},[
    'span',
    { className: 'a', onclick: menu.set_trash },
    ['Trash']
  ],
  ' this node.');
}

node_class.prototype.setState = function(state) {
}

node_class.prototype.getState = function(mode) {
  return {};
}

