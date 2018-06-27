/* DOM ELEM */
function domElem_class(parentElem) {
  this.lastParent = parentElem;
}

domElem_class.prototype.addElem = function(tagName,attrs,children) {
  const parent = this.lastParent;
  // special case: html instead of tagName
  if (tagName && tagName.charAt(0) === '<') {
    parent.innerHTML = tagName;
    return this;
  }
  // each triplet must start with a tagName string, and may be followed by an attribute object and an array of child-triplets
  const elem = parent.appendChild( document.createElement(tagName) )
  if (attrs) for (let k in attrs) elem[k] = attrs[k];
  this.lastParent = elem;
  if (children) for (let i=0; i<children.length; i++) {
    const triplet = children[i];
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
  this.lastParent = parent;
  return this;
}


/* CONTEXT MENU */

function contextMenu_class(callerElem,title,parentMenu) {
  // close context menu's before creating a new one.
  if (parentMenu) parentMenu.addChild(this);
  const menuList = contextMenu_class.prototype.menuList;
  for (let i=0; i<menuList.length; i++) {
    const menu = menuList[i];
    if (menu.autoHide && !menu.childList.length) menu.hide();
  }

  this.callerElem = callerElem;
  this.parentMenu = parentMenu;
  this.childList = [];
  menuList.push(this);

  const div = document.createElement('div');
  div.className = 'menuWindow';

  // positioning of the menu
  const body = document.body;
  const html = document.documentElement;
  let scrollTop = window.pageYOffset || html.scrollTop || body.scrollTop || 0;
  let scrollLeft = window.pageXOffset || html.scrollLeft || body.scrollLeft || 0;
  const box = callerElem.getBoundingClientRect();
  const bottom = box.bottom + scrollTop;
  const left = box.left + scrollLeft;
  let menuLeft = (left+10);
  let menuTop = (bottom-4);
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
        hide.innerHTML = '&#x274C;';
        hide.onclick = () => { this.hide() }
      bar.appendChild( hide );
    div.appendChild(bar);
  } else {
    div.onmouseleave = () => { 
      window.contextMenuTimeout = setTimeout(() => { 
        if (this.autoHide && !this.childList.length) this.hide(); 
      }, 500)
    }
    div.onmouseenter = () => { clearTimeout(window.contextMenuTimeout); }
  }

  // menu content: table inside form
  const form = document.createElement('form')
  const table = document.createElement('table');
  form.appendChild(table);
  div.appendChild(form);
  div.style.display = 'block';
  body.appendChild(div)

  this.menuElem = div;
  this.formElem = form;
  this.tableElem = table;
  this.lastParent = table;

  this.widgets = {};
  this.data = {};
}

contextMenu_class.prototype = new domElem_class();
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

contextMenu_class.prototype.hide = function() {
  const menuList = contextMenu_class.prototype.menuList;
  const i = menuList.indexOf(this);
  if (i > -1) {
    if (this.menuElem) document.body.removeChild(this.menuElem);
    const last = menuList.pop();
    if (menuList.length > i) menuList[i] = last;
  }
  for (let i=0; i<this.childList.length; i++) this.childList[i].hide();
  if (this.parentMenu) this.parentMenu.delChild(this);
}

contextMenu_class.prototype.emptyTable = function() {
  this.tableElem.innerHTML = '';
  return this;
}

contextMenu_class.prototype.addRow = function() {
  const tr = this.tableElem.appendChild( document.createElement('tr') );
  let i0 = 0;
  if (arguments[0] && arguments[0].constructor === Object) {
    const attrs = arguments[0];
    for (let k in attrs) tr[k] = attrs[k];
    i0 = 1;
  }
  this.lastParent = tr;
  // additional arguments may contain cells with just a single argument
  for (let i=i0; i<arguments.length; i++) { this.addCell(arguments[i]) }
  return this;
}

contextMenu_class.prototype.addCell = function() {
  let attrs, children = arguments;
  if (children[0].constructor === Object) {
    attrs = children[0];
    children = Array.prototype.slice.call(arguments,[1]);
  }
  const widgets = [];
  for (let i=0; i<children.length; i++) {
    if (children[i] instanceof widget_class) {
      widgets.push(children[i]);
      children[i] = children[i].getTriplet(this);
    }
  }
  this.addElem('td',attrs,children);
  // some widgets can only display values after entering the DOM
  for (let i=0; i<widgets.length; i++) widgets[i].update();
  return this;
}

/*
contextMenu_class.prototype.addElem = function(tagName,attrs,children) {
  const parent = this.lastParent;
  // special case: html instead of tagName
  if (tagName && tagName.charAt(0) === '<') {
    parent.innerHTML = tagName;
    return this;
  }
  // each triplet must start with a tagName string, and may be followed by an attribute object and an array of child-triplets
  const elem = parent.appendChild( document.createElement(tagName) )
  if (attrs) for (let k in attrs) elem[k] = attrs[k];
  this.lastParent = elem;
  if (children) for (let i=0; i<children.length; i++) {
    const triplet = children[i];
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
  this.lastParent = parent;
  return this;
}
*/

contextMenu_class.prototype.addWidget = function(widget) {
  this.widgets[widget.name] = widget;
}

contextMenu_class.prototype.getWidget = function(name) {
  return this.widgets[name];
}

contextMenu_class.prototype.setWidgetValue = function(name,value) {
  let widget = this.widgets[name];
  if (widget) {
    widget.setValue(value,this);
  } else {
    widget = this.formElem[name];
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

contextMenu_class.prototype.getWidgetValue = function(name) {
  let widget = this.widgets[name];
  if (widget) {
    return widget.getValue();
  } else {
    widget = this.formElem[name];
    if (widget.tagName.toLowerCase() == 'input') return widget.value;
    if (widget.tagName.toLowerCase() == 'select') return widget.options[widget.selectedIndex].value;
  }
}

contextMenu_class.prototype.getWidgetValues = function(/* names */) {
  let result = Array(arguments.length);
  for (let i=0; i<arguments.length; i++) result[i] = this.getWidgetValue(arguments[i]);
  return result;
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
  menu.addWidget(this);
  return this.triplet();
}


// CLASS inputWidget
function inputWidget_class(name,value,type,style) {
  widget_class.apply(this,[name,value]);
  this.style = style;
}
inputWidget_class.prototype = new widget_class();

// update the display of the widget
inputWidget_class.prototype.update = function() {
  const field = this.menu.formElem[this.name];
  if (field) field.value = this.value;
}

inputWidget_class.prototype.triplet = function() {
  const widget = this;
  const attrs = { type:'text', name:this.name, onchange: function(evt) { widget.applyChange(this.value,evt || window.event); } };
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
function selectWidget_class(name,value,choices) {
  widget_class.apply(this,[name,value]),
  this.choices = choices;
}
selectWidget_class.prototype = new widget_class();

selectWidget_class.prototype.update = function() {
  const opts = this.menu.formElem[this.name].options;
  for (let i=0; i<opts.length; i++) {
    if (opts[i].value == this.value) { opts[i].selected = true; break; }
  }
}

selectWidget_class.prototype.triplet = function() {
  const widget = this;
  const opts = [];
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
  const textField = this.menu.formElem[this.name][1]; 
  textField.value = v;
  const rangeField = this.menu.formElem[this.name][0];
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
  const rangeField = this.menu.formElem[this.name][0];
  rangeField.min = min;
  rangeField.max = max;
  rangeField.step = step;
}  