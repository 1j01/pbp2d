function serialize(points, connections, isSelection) {
	return ARSON.stringify({
		format: "pbp2d",
		formatVersion: 0.1,
		isSelection: !!isSelection,
		points: points,
		connections: connections
	});
}
function deserialize(serialized) {
	return ARSON.parse(serialized);
}

function getState() {
	return serialize(points, connections);
}
function setState(serialized) {
	var state = deserialize(serialized);
	points = state.points;
	connections = state.connections;
	deselect();
}

function undoable() {
	undos.push(getState());
	redos = [];
}
function undo() {
	if (undos.length < 1) return false;
	redos.push(getState());
	setState(undos.pop());
	return true;
}
function redo() {
	if (redos.length < 1) return false;
	undos.push(getState());
	setState(redos.pop());
	return true;
}
function deselect() {
	selection.points = [];
	selection.connections = [];
}
function copySelected() {
	serializedClipboard = serialize(selection.points, selection.connections, true);
	// console.log(deserialize(serializedClipboard));
}
function deleteSelected() {
	for (var i = selection.points.length - 1; i >= 0; i--) {
		var p = selection.points[i];
		for (var j = connections.length - 1; j >= 0; j--) {
			var c = connections[j];
			if (c.p1 === p || c.p2 === p) {
				// console.log(c, j);
				connections.splice(j, 1);
			}
		}
		points.splice(points.indexOf(p), 1);
		// ctx.lineWidth = 10;
		// ctx.strokeStyle = "rgba(255,0,0,0.5)";
		// ctx.beginPath();
		// ctx.arc(p.x, p.y, 3, 0, Math.PI * 2, false);
		// ctx.stroke();
	}
	deselect();
}
function main() {
	gui.overlay();

	canvas = document.createElement("canvas");
	document.body.appendChild(canvas);
	canvas.border = 0;

	mouse = { x: 0, y: 0, d: 0 };
	mousePrevious = { x: 0, y: 0, d: 0 };
	keys = {};

	ntm = null;
	sd2m = 1000;
	connections = [];
	points = [];

	play = true;
	collision = false;
	autoConnect = false;
	gravity = 0.1;
	audioEnabled = false;
	audioStyle = 1;
	audioViz = false;

	tool = "create-points";
	selection = {
		points: [],
		connections: []
	};
	undos = [];
	redos = [];
	serializedClipboard = null;

	canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
	addEventListener('keydown', function (e) {
		if(e.defaultPrevented){
			return;
		}
		if(
			document.activeElement instanceof HTMLInputElement ||
			document.activeElement instanceof HTMLTextAreaElement ||
			!window.getSelection().isCollapsed
		){
			return; // don't prevent interaction with inputs or textareas, or copying text in windows
		}
		if (!keys[e.keyCode]) {
			keys[e.keyCode] = true;
			// console.log(String.fromCharCode(e.keyCode) + ": ", e.keyCode);
			if (e.keyCode === 46) { // delete
				undoable();
				deleteSelected();
			} else switch (String.fromCharCode(e.keyCode)) {
				case "P"://pause/play
					play = !play;
					break;
				case "Z"://undo (+shift=redo)
					if (e.shiftKey) { redo(); } else { undo(); }
					break;
				case "Y"://redo
					redo();
					break;
				case "A"://select all
					selection.points = Array.from(points);
					selection.connections = Array.from(connections);
					break;
				case "D"://deselect all
					deselect();
					break;
				case "C"://copy selection
					if (selection.points.length > 0) {
						copySelected();
					}
					break;
				case "X"://cut selection
					if (selection.points.length > 0) {
						copySelected();
						undoable();
						deleteSelected();
					}
					break;
				case "V"://pasta
					undoable();
					if (serializedClipboard) {
						var clipboard = deserialize(serializedClipboard);
						var minx = Infinity, miny = Infinity;
						for (var i = 0; i < clipboard.points.length; i++) {
							var p = clipboard.points[i];
							minx = Math.min(minx, p.x);
							miny = Math.min(miny, p.y);
						}
						for (var i = 0; i < clipboard.points.length; i++) {
							var p = clipboard.points[i];
							p.x -= minx - mouse.x;
							p.y -= miny - mouse.y;
						}
						points = points.concat(clipboard.points);
						connections = connections.concat(clipboard.connections);
					}
					break;
				case "S":
					selectTool("selection");
					break;
				case "Q":
					selectTool("create-points-fast");
					break;
				case "W":
					selectTool("create-points");
					break;
				case "G":
					selectTool("glue");
					break;
				default:
					return; // don't prevent default
			}
		}
		e.preventDefault();
	});
	addEventListener('keypress', function (e) {
		if (String.fromCharCode(e.keyCode) === "A") {
			return false;
		}
	});
	addEventListener('keyup', function (e) { delete keys[e.keyCode]; });
	var removeSelectionAndBlur = function () {
		if (window.getSelection) {
			if (window.getSelection().empty) {  // Chrome
				window.getSelection().empty();
			} else if (window.getSelection().removeAllRanges) {  // Firefox
				window.getSelection().removeAllRanges();
			}
		} else if (document.selection) {  // IE?
			document.selection.empty();
		}
		document.activeElement.blur();
	};
	var moveMouse = function(pageX, pageY) {
		mouse.x = pageX - canvas.getBoundingClientRect().left;
		mouse.y = pageY - canvas.getBoundingClientRect().top;
	};
	canvas.addEventListener('mousedown', function (e) {
		moveMouse(e.pageX, e.pageY);
		if (e.button == 0) {
			mouse.left = true;
		} else {
			mouse.right = true;
		}
		e.preventDefault();
		removeSelectionAndBlur();
	});
	canvas.addEventListener('touchstart', function (e) {
		moveMouse(e.changedTouches[0].pageX, e.changedTouches[0].pageY);
		mouse.left = true;
		removeSelectionAndBlur();
		e.preventDefault();
	});
	addEventListener('mouseup', function (e) {
		if (e.button == 0) {
			mouse.left = false;
		} else {
			mouse.right = false;
		}
		e.preventDefault();
	});
	addEventListener('touchend', function (e) {
		mouse.left = false;
		mouse.right = false;
	});
	addEventListener('touchcancel', function (e) {
		mouse.left = false;
		mouse.right = false;
	});
	addEventListener('mousemove', function(e){
		moveMouse(e.pageX, e.pageY);
	}, false);
	addEventListener('touchmove', function(e){
		moveMouse(e.changedTouches[0].pageX, e.changedTouches[0].pageY);
	}, false);

	/*(onresize = function () {
		//canvas.width=document.body.clientWidth;
		//canvas.height=document.body.clientHeight;
		canvas.width = innerWidth;
		canvas.height = innerHeight - 5;
		step();
	})();*/

	setInterval(step, 15);

	shoopen = 0;

	try {
		actx = new AudioContext();
		actx.suspend();
		/*
		var x, node, freq = 440;
		if (actx.createScriptProcessor) {
			node = actx.createScriptProcessor(1024, 1, 1);
		} else {
			node = actx.createJavaScriptNode(1024, 1, 1);
		}
		node.onaudioprocess = function (e) {
			for (var i = 0; i < points.length; i++) {
				var p = points[i];
				shoopen += p.x + p.y;
			}
			//console.log(shoopen);
			shoopen = Math.abs(shoopen) % 255;
			var data = e.outputBuffer.getChannelData(0);
			for (var i = 0; i < data.length; i++) {
				data[i] = Math.sin(x * freq) * 35
					+ shoopen * Math.random() * 0.001
					+ Math.sin(x / 4.02) * shoopen * 0.01;
				x++;
			}
		};
		node.connect(actx.destination);
		// node.start ? node.start() : node.noteOn(0);
		*/

		gain = actx.createGain();
		gain.gain.setValueAtTime(0, actx.currentTime);
		gain.connect(actx.destination);

		oscillator = actx.createOscillator();
		oscillator.type = 'square';
		oscillator.frequency.setValueAtTime(440, actx.currentTime); // value in hertz
		oscillator.connect(gain);
		oscillator.start();

	} catch (e) {
		audioSetupError = e;
		console.warn(e);
	}
}


function step() {
	if (canvas.width != innerWidth) {
		canvas.width = innerWidth;
	}
	if (canvas.height != innerHeight) {
		canvas.height = innerHeight;
	}

	//Drawing setup
	var ctx = canvas.getContext("2d");
	//ctx.fillStyle = "rgba(0,0,20,0.2)";
	//ctx.fillRect(0,0,canvas.width,canvas.height);

	//Clear.
	ctx.fillStyle = "rgba(0,0,20,1)";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.lineWidth = 1;

	ctx.save();

	if (tool === "selection" && mouse.left && mousePrevious.left) {
		selection = {
			x: selection.x, y: selection.y,
			x1: Math.min(selection.x, mouse.x),
			y1: Math.min(selection.y, mouse.y),
			x2: Math.max(selection.x, mouse.x),
			y2: Math.max(selection.y, mouse.y),
			points: [], connections: [],
		};

		for (var j = connections.length - 1; j >= 0; j--) {
			var c = connections[j];
			if (c.p1.x < selection.x2 && c.p1.x > selection.x1)
				if (c.p1.y < selection.y2 && c.p1.y > selection.y1)
					if (c.p2.x < selection.x2 && c.p2.x > selection.x1)
						if (c.p2.y < selection.y2 && c.p2.y > selection.y1) {
							selection.connections.push(c);
						}
		}
		for (var i = points.length - 1; i >= 0; i--) {
			var p = points[i];
			if (p.x < selection.x2 && p.x > selection.x1)
				if (p.y < selection.y2 && p.y > selection.y1) {
					selection.points.push(p);
				}
		}

		ctx.fillStyle = "rgba(0,255,200,0.1)";
		ctx.strokeStyle = "rgba(0,255,200,0.5)";
		ctx.beginPath();
		ctx.rect(
			selection.x1 + .5,
			selection.y1 + .5,
			selection.x2 - selection.x1,
			selection.y2 - selection.y1
		);
		ctx.fill();
		ctx.stroke();
	}

	if (tool === "selection") {
		if (mouse.left && !mousePrevious.left) {
			selection = { x: mouse.x, y: mouse.y, points: [], connections: [] };
		}
	} else if (tool.match(/create-points/)) {
		if (mouse.left && (!mousePrevious.left || tool === "create-points-fast")) {
			if (!mousePrevious.left) undoable();
			points.push({
				x: mouse.x,//position
				y: mouse.y,
				px: mouse.x,//previous position
				py: mouse.y,
				vx: 0,//velocity
				vy: 0,
				fx: 0,//force
				fy: 0,
				fixed: keys[16],
				color: keys[16] ? "grey" : ("hsl(" + (Math.random() * 360) + "," + (Math.random() * 50 + 50) + "%," + (Math.random() * 50 + 50) + "%)")
			});
		}
	}
	if (play) {
		if (mouse.right && ntm) {
			ntm.fx += (mouse.x - ntm.x - ntm.vx) / sd2m;
			ntm.fy += (mouse.y - ntm.y - ntm.vy) / sd2m;
			//ntm.x=mouse.x;
			//ntm.y=mouse.y;
		} else {
			if (mousePrevious.right && ntm) {
				//ntm.vx=(ntm.x-ntm.px)*10;
				//ntm.vy=(ntm.y-ntm.py)*10;
			}
			ntm = null;
			sd2m = 100;
		}

		var freq = 440; // or something
		var amplitude = 0;
		//for(var g=0;g<4;g++){
		for (var j = connections.length - 1; j >= 0; j--) {
			var c = connections[j];
			var d = distance(c.p1.x + c.p1.vx, c.p1.y + c.p1.vy, c.p2.x + c.p2.vx, c.p2.y + c.p2.vy);
			var dd = (d - c.dist);
			var dx = (c.p2.x + c.p2.vx - c.p1.x - c.p1.vx);
			var dy = (c.p2.y + c.p2.vy - c.p1.y - c.p1.vy);
			//d=Math.abs(d)+1;
			d++;
			var f = c.force / 10;
			c.p1.fx += dx / d * dd * f;
			c.p1.fy += dy / d * dd * f;
			c.p2.fx -= dx / d * dd * f;
			c.p2.fy -= dy / d * dd * f;
			if (dd > c.dist * 3) {
				connections.splice(j, 1);
				// console.log(dd);
				amplitude += Math.min(Math.abs(dd), 100) / 100;
				freq = 0;
			}
			if (!c.p1.fixed && !c.p2.fixed) {
				var vd = distance(c.p1.vx, c.p1.vy, c.p2.vx, c.p2.vy);
				var fd = distance(c.p1.fx, c.p1.fy, c.p2.fx, c.p2.fy);
				var v = distance(0, 0, c.p1.vx, c.p1.vy) + distance(0, 0, c.p2.vx, c.p2.vy);
				vdd = vd - (c.vdp || 0);
				// var angle = Math.atan2(c.p1.x, c.p1.y, c.p2.x, c.p2.y);
				if (audioStyle == 0) {
					var amp_add = vd / 1000;
				}
				// var amp_add = vd / 1000;
				// var amp_add = vd ** 1.2 / 1000;
				// var amp_add = vd / 1000;
				if (audioStyle == 1 || audioStyle == 2) {
					var amp_add = vdd / 1000;
				}
				// var amp_add = vd / 5000 + vdd / 1000;
				// var amp_add = vd / (Math.max(Math.abs(fd), 1) ** 2) / 100;
				// var amp_add = vd * v / 1000;
				// var amp_add = vdd / 1000 * vdd > 1;
				if (audioStyle == 0) {
					var freq_add = dd;
				}
				// var freq_add = dd;
				// var freq_add = -dd;
				// var freq_add = Math.abs(dd);
				// var freq_add = angle;
				// var freq_add = -dd * vdd / 10;
				// var freq_add = -dd * vdd > 1;
				// var freq_add = dd * vdd > 1;
				// var freq_add = dd * Math.max(0, Math.min(1, vdd / 5 - 10)) * 5;
				// var freq_add = Math.max(0, Math.min(20, 
				// 	dd * Math.max(0, Math.min(1,
				// 		vdd / 5 - 10
				// 	)) * 50
				// ));
				// var freq_add = dd * v / 100;
				// var freq_add = dd * (dd > 1);
				// var freq_add = dd * (v ** 1.5 / 100);
				// if (audioStyle == 1) {
				if (audioStyle == 1 || audioStyle == 2) {
					var freq_add = dd * (~~v) / 100;
				}
				// if (audioStyle == 2) {
				// 	var freq_add = dd * (~~v) / 100 * Math.random();
				// }
				freq += freq_add;
				amplitude += amp_add;
				// ctx.fillStyle = "red";
				// ctx.fillRect(j*2, 0, 2, dd);
				if (audioViz) {
					ctx.fillStyle = "yellow";
					ctx.fillRect(j*2, 0, 2, freq_add * 5);
					ctx.fillStyle = "green";
					ctx.fillRect(j*2, 0, 2, amp_add * 2000);
				}

				c.vdp = vd;
			}
		}
	}
	//Draw and step the points.
	for (var i = points.length - 1; i >= 0; i--) {
		var p = points[i];
		if (play && !p.fixed) {
			//Apply connection forces.
			p.vx += p.fx;
			p.vy += p.fy;
			//"air friction"
			//p.vx*=0.99;
			//p.vy*=0.99;
			//gravity
			p.vy += gravity;
			//Move
			p.px = p.x;
			p.py = p.y;
			p.x += p.vx;
			p.y += p.vy;

			var friction = 2, cor = 4;
			if (p.x > canvas.width - 2) {
				p.x = canvas.width - 2;
				p.vx = -p.vx / cor;
				p.vy /= friction;
			}
			if (p.y > canvas.height - 2) {
				p.y = canvas.height - 2;
				p.vy = -p.vy / cor - Math.random() / 6;
				p.vx /= friction;
			}
			if (p.y < 2) {
				p.y = 2;
				p.vy = -p.vy / cor;
				p.vx /= friction;
			}
			if (p.x < 2) {
				p.x = 2;
				p.vx = -p.vx / cor;
				p.vy /= friction;
			}
			// if (Math.sign(p.x - p.px - p.vx) > 0) {
				
			// }
			for (var j = 0; j < gui.modals.length; j++) {
				var m = gui.modals[j];
				var r = m.$m.getBoundingClientRect();
				var o = 3;
				r = {left: r.left - o, top: r.top - o, right: r.right + o, bottom: r.bottom + o};
				r.width = r.right - r.left;
				r.height = r.bottom - r.top;
				if (p.x >= r.left && p.x <= r.right) {
					if (p.y >= r.top && p.y <= r.bottom) {
						// convert to rect unit coords (0 = left, 1 = right, 0 = top, 1 = bottom)
						// then find whether it's in each of two diagonal halves
						// and use that to find whether it's in opposing diagonal quadrants
						// i.e. whether it's more horizontal or more vertical
						var in_upper_right_half = (p.x - r.left) / r.width > (p.y - r.top) / r.height;
						var in_upper_left_half = (r.right - p.x) / r.width > (p.y - r.top) / r.height;
						var in_left_or_right_quadrant = in_upper_right_half ^ in_upper_left_half;
						if (in_left_or_right_quadrant) {
							if (p.x < r.left + r.width / 2) {
								p.x = r.left;
								p.vx = -Math.abs(p.vx) / cor;
								//p.vy/=friction;
							} else {
								p.x = r.right;
								p.vx = Math.abs(p.vx) / cor;
								//p.vy/=friction;
							}
						} else {
							if (p.y < r.top + r.height / 2) {
								p.y = r.top;
								p.vy = -Math.abs(p.vy) / cor;
								p.vx /= friction;
							} else {
								p.y = r.bottom;
								p.vy = Math.abs(p.vy) / cor;
								p.vx /= friction;
							}
						}
					}
				}
			}
		}
		ctx.fillStyle = p.color;
		ctx.fillRect(p.x - 2, p.y - 2, 4, 4);

		var d2m = distance(p.x, p.y, mouse.x, mouse.y);
		if (!mouse.right) {
			if (d2m < sd2m && !p.fixed) {
				ntm = p;
				sd2m = d2m;
			}
		}

		for (var j = points.length - 1; j >= 0; j--) {
			if (i == j) continue;
			var p2 = points[j];
			var d = distance(p.x, p.y, p2.x, p2.y);
			if (d < 50) {
				function numConn(p) {
					var nc = 0;
					for (var i = 0; i < connections.length; i++) {
						if (connections[i].p1 === p) nc++;
						if (connections[i].p2 === p) nc++;
					}
					return nc;
				}
				if ((d2m < 30 && (tool === "glue" && mouse.left || keys[32])) || (autoConnect && d < 50 && numConn(p) < 6 && numConn(p2) < 3)) {
					var connected = false;
					for (var ci = connections.length - 1; ci >= 0; ci--) {
						if (
							(connections[ci].p1 === p && connections[ci].p2 === p2)
							|| (connections[ci].p1 === p2 && connections[ci].p2 === p)
						) {
							connected = true;
							break;
						}
					}
					if (!connected) {
						connections.push({ p1: p, p2: p2, dist: 60, force: 1 });
						//connections.push({p1:p,p2:p2,dist:Math.ceil(d*.15)*10});
					}
				}
			}
		}
		p.fx = 0;
		p.fy = 0;
	}
	for (var j = connections.length - 1; j >= 0; j--) {
		var c = connections[j];
		/*if(points.indexOf(c.p1)===-1 || points.indexOf(c.p2)===-1){
			connections.splice(j,1);
			continue;
		}*/
		var hit = false;
		if (collision && play) {
			for (var i = points.length - 1; i >= 0; i--) {
				var p = points[i];
				if (p == c.p1 || p == c.p2) continue;
				if (areConnected(p, c.p1)) continue;
				if (areConnected(p, c.p2)) continue;
				//this check shouldn't be here
				if (p.x != p.px || p.y != p.py) {

					var is = intersection(p.x, p.y, p.px, p.py, c.p1.x, c.p1.y, c.p2.x, c.p2.y)
						|| intersection(p.x, p.y, p.px, p.py, c.p1.px, c.p1.py, c.p2.px, c.p2.py);

					if (is) {
						hit = true;

						var p_dir = Math.atan2(p.x - p.px, p.y - p.py);
						var normal = Math.atan2(c.p1.x - c.p2.x, c.p1.y - c.p2.y) + Math.PI / 2;
						var speed = distance(p.x, p.y, p.px, p.py) / (p.friction = 2);

						if (false) {
							normal += Math.PI;
							// console.log("reversed normal");
						}
						//console.log("normal:",normal," p_dir:",p_dir," reflection:",normal-p_dir," speed:",speed);

						p.x = is.x + Math.sin(normal - p_dir) / 10;
						p.y = is.y + Math.cos(normal - p_dir) / 10;
						p.vx = Math.sin(normal - p_dir) * speed;
						p.vy = Math.cos(normal - p_dir) * speed;
						//var l

						ctx.strokeStyle = "aqua";
						ctx.beginPath();
						//ctx.arc(is.x,is.y,50,0,Math.PI*2,true);
						ctx.moveTo(is.x, is.y);
						var r = Math.random() * 0.5 - 0.25, d = Math.random() * 5;
						ctx.lineTo(is.x + Math.sin(normal + r) * d, is.y + Math.cos(normal + r) * d);
						var r = Math.random() * 0.7 - 0.7 / 2, d = Math.random() * 5 + 3;
						ctx.lineTo(is.x + Math.sin(normal + r) * d, is.y + Math.cos(normal + r) * d);
						var r = Math.random() * 0.9 - 0.9 / 2, d = Math.random() * 10 + 5;
						ctx.lineTo(is.x + Math.sin(normal + r) * d, is.y + Math.cos(normal + r) * d);
						ctx.stroke();
					}
				}
			}
		}
		/**
		var r = Math.random();
		ctx.strokeStyle = hit && Math.random() < 0.9 ? "white" : c.p1.color;
		ctx.strokeStyle = c.p1.color;
		ctx.beginPath();
		ctx.moveTo(
			(c.p2.x - c.p1.x) * 0.2 + c.p1.x,
			(c.p2.y - c.p1.y) * 0.2 + c.p1.y
		);
		ctx.quadraticCurveTo(
			(c.p2.x - c.p1.x) * 0.4 + c.p1.x + Math.sin(r) * 20,
			(c.p2.y - c.p1.y) * 0.4 + c.p1.y + Math.cos(r) * 20,
			(c.p2.x - c.p1.x) * 0.4 + c.p1.x,
			(c.p2.y - c.p1.y) * 0.4 + c.p1.y
		);
		ctx.stroke();
		ctx.strokeStyle = hit && Math.random() < 0.9 ? "white" : c.p2.color;
		ctx.strokeStyle = c.p2.color;
		ctx.beginPath();
		ctx.moveTo(
			(c.p2.x - c.p1.x) * 0.8 + c.p1.x,
			(c.p2.y - c.p1.y) * 0.8 + c.p1.y
		);
		ctx.quadraticCurveTo(
			(c.p2.x - c.p1.x) * 0.6 + c.p1.x + Math.sin(r) * 20,
			(c.p2.y - c.p1.y) * 0.6 + c.p1.y + Math.cos(r) * 20,
			(c.p2.x - c.p1.x) * 0.6 + c.p1.x,
			(c.p2.y - c.p1.y) * 0.6 + c.p1.y
		);
		ctx.stroke();
		/**/
		ctx.strokeStyle = hit && Math.random() < 0.9 ? "white" : c.p1.color;
		ctx.strokeStyle = c.p1.color;
		ctx.beginPath();
		ctx.moveTo((c.p2.x - c.p1.x) * 0.2 + c.p1.x, (c.p2.y - c.p1.y) * 0.2 + c.p1.y);
		ctx.lineTo((c.p2.x - c.p1.x) * 0.4 + c.p1.x, (c.p2.y - c.p1.y) * 0.4 + c.p1.y);
		ctx.stroke();
		ctx.strokeStyle = hit && Math.random() < 0.9 ? "white" : c.p2.color;
		ctx.strokeStyle = c.p2.color;
		ctx.beginPath();
		ctx.moveTo((c.p2.x - c.p1.x) * 0.8 + c.p1.x, (c.p2.y - c.p1.y) * 0.8 + c.p1.y);
		ctx.lineTo((c.p2.x - c.p1.x) * 0.6 + c.p1.x, (c.p2.y - c.p1.y) * 0.6 + c.p1.y);
		ctx.stroke();
		/**/
	}

	ctx.lineWidth = 1;
	ctx.strokeStyle = "rgba(0,255,200,0.5)";
	for (var i = selection.points.length - 1; i >= 0; i--) {
		var p = selection.points[i];
		ctx.beginPath();
		ctx.arc(p.x, p.y, 3, 0, Math.PI * 2, false);
		ctx.stroke();
	}

	ctx.lineWidth = 3;
	ctx.strokeStyle = "rgba(0,255,200,0.5)";
	for (var j = selection.connections.length - 1; j >= 0; j--) {
		var c = selection.connections[j];
		if (keys[46]) {
			var idx = connections.indexOf(c);
			if (idx >= 0) connections.splice(idx, 1);
			selection.connections.splice(j, 1);
			continue;
		}
		ctx.beginPath();
		ctx.moveTo(c.p1.x, c.p1.y);
		ctx.lineTo(c.p2.x, c.p2.y);
		ctx.stroke();
	}
	if (!play) {
		ctx.fillStyle = "rgba(255,255,255,0.5)";
		var cx = canvas.width / 2;
		var cy = canvas.height / 2;
		var h = 100, w = 30, sx = 40;
		ctx.fillRect(cx - sx - w / 2, cy - h / 2, w, h);
		ctx.fillRect(cx + sx - w / 2, cy - h / 2, w, h);
	}

	ctx.restore();
	mousePrevious.left = mouse.left;
	mousePrevious.right = mouse.right;
	mousePrevious.x = mouse.x;
	mousePrevious.y = mouse.y;

	if (audioEnabled && play) {
		if (actx.state === "suspended") {
			actx.resume();
		}
	} else {
		if (actx.state === "running") {
			actx.suspend();
		}
	}

	if (typeof oscillator !== "undefined" && freq != null) {
		if (audioStyle == 0 || audioStyle == 2) {
			oscillator.frequency.setValueAtTime(freq, actx.currentTime);
		} else {
			oscillator.frequency.linearRampToValueAtTime(freq, actx.currentTime + 0.05);
		}
		if (audioStyle == 0) {
			gain.gain.setValueAtTime(amplitude, actx.currentTime);
		} else {
			gain.gain.linearRampToValueAtTime(amplitude, actx.currentTime + 0.001);
		}
	}
}
function intersection(x1, y1, x2, y2, x3, y3, x4, y4) {
	var x = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));
	var y = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));
	if (isNaN(x) || isNaN(y)) {
		return false;
		// console.log(x, y);
	} else {
		if (x1 > x2) {
			if (!(x2 < x && x < x1)) { return false; }
		} else {
			if (!(x1 < x && x < x2)) { return false; }
		}
		if (y1 >= y2) {
			if (!(y2 < y && y < y1)) { return false; }
		} else {
			if (!(y1 < y && y < y2)) { return false; }
		}
		if (x3 >= x4) {
			if (!(x4 < x && x < x3)) { return false; }
		} else {
			if (!(x3 < x && x < x4)) { return false; }
		}
		if (y3 >= y4) {
			if (!(y4 < y && y < y3)) { return false; }
		} else {
			if (!(y3 < y && y < y4)) { return false; }
		}
	}
	return { x: x, y: y };
}
function createTerrain() {
	var x = Math.random() * 200;
	var y = Math.random() * 200 + 200;
	var ytend = 0, xtend = 10;
	var p, pp;
	for (var i = 0; i < 50; i++) {
		x += Math.random() * 10 - 5 + xtend;
		y += Math.random() * 10 - 5 + ytend;
		ytend += Math.random() * 20 - 10;
		xtend += Math.random() * 35 - 15;
		ytend *= 0.945;
		xtend *= 0.9;
		pp = p;
		p = {
			x: x,//position
			y: y,
			px: x,//previous position
			py: y,
			vx: 0,//velocity
			vy: 0,
			fx: 0,//force
			fy: 0,
			fixed: true,
			color: "green"
		};
		points.push(p);
		if (pp) connections.push({ p1: p, p2: pp, dist: -1, force: -1 });
	}
}
function rope(x1, y1, x2, y2, seg, force) {
	force = force || 1;
	var pp, p;
	for (var i = 0; i < seg; i++) {
		var x = (x2 - x1) * (i / seg) + x1;
		var y = (y2 - y1) * (i / seg) + y1;
		pp = p;
		p = {
			x: x,//position
			y: y,
			px: x,//previous position
			py: y,
			vx: 0,//velocity
			vy: 0,
			fx: 0,//force
			fy: 0,
			fixed: false,
			color: "#FC5"
		};
		points.push(p);
		if (pp) connections.push({ p1: p, p2: pp, dist: distance(p.x, p.y, pp.x, pp.y), force: force });
	}
}
function areConnected(p1, p2, depth) {
	return false; // TODO I guess? except I'm not planning on trying to get collision working
}
function distance(x1, y1, x2, y2) {
	return Math.sqrt(sqrDistance(x1, y1, x2, y2));
}
function sqrDistance(x1, y1, x2, y2) {
	return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}
function r() { return Math.random() * 2 - 1; }

function guiStuff() {
	var ops = new Modal().position("left top").title("Options").content(
		"<h3>Audio:</h3>"
		+ "<label><input type='checkbox' id='audiofx'/>Audio</label>" /* WET: label text referenced */
		+ "<br><label><input type='checkbox' id='audiofx-viz'/>Visualization</label>"
		+ "<br><label>Audio Style: <div class='select-wrapper'><select id='audiofx-style'>"
			+ "<option value='0'>Scorched Earth</option>"
			+ "<option value='1' selected>Collisions</option>"
			+ "<option value='2'>Hybrid</option>"
		+ "</select></div></label>"
		+ "<h3>Simulation:</h3>"
		+ "<label>Gravity: <input type='number' id='grav' value=" + gravity + " step=0.05 min=-50 max=50/></label>"
		+ "<br><label><input type='checkbox' id='ac'/>AutoConnect</label>"
		+ "<br><label><input type='checkbox' id='terrain'/>\"Terrain\"</label>"
		+ "<br><label><input type='checkbox' id='coll'/>Poor, Broken Collision</label>"
		+ "<h3>Windows:</h3>"
		+ "<button id='resz'>Resizable Window</button>"
		+ "<br><button id='help'>Help</button>"
		+ "<button id='todo'>Todo</button>"
	);

	var $audioCheckbox = ops.$("#audiofx");
	var $audioVizCheckbox = ops.$("#audiofx-viz");
	var $audioStyleSelect = ops.$("#audiofx-style");
	
	var showAudioSetupError = function() {
		new Modal().position("center").title("Audio Setup Failed").content(
			"<p>Initialization failed, audio is not available.</p>"
			+ "<pre class='padded'/>"
		).$c.querySelector("pre").textContent = audioSetupError.stack;
		$audioCheckbox.disabled = true;
		$audioStyleSelect.disabled = true;
		$audioCheckbox.checked = false;
	};
	// TODO: maybe enable/disable audio related sub-controls based on audio checkbox
	// ...except maybe just the audio style - not the viz
	audioEnabled = $audioCheckbox.checked;
	$audioCheckbox.onchange = function () {
		audioEnabled = $audioCheckbox.checked;
		if (typeof audioSetupError !== "undefined") {
			showAudioSetupError();
			return;
		}
	};
	audioStyle = parseInt($audioStyleSelect.value);
	$audioStyleSelect.onchange = function () {
		audioStyle = parseInt($audioStyleSelect.value);
		if (typeof audioSetupError !== "undefined") {
			showAudioSetupError();
			return;
		}
		if (!$audioCheckbox.checked) {
			new Modal().position("center").title("Audio Not Enabled").content(
				"<p>Check the box to enable 'Audio' first.</p>"
			);
			return;
		}
	};
	audioViz = $audioVizCheckbox.checked;
	$audioVizCheckbox.onchange = function () {
		audioViz = $audioVizCheckbox.checked;
		if (!$audioCheckbox.checked && audioViz) {
			new Modal().position("center").title("Audio Not Enabled").content(
				"<p>You <em>can</em> enjoy the viz without sound.</p>"
				+"<p>Check the box to enable 'Audio' to hear it.</p>"
			);
			return;
		}
	};
	ops.$("#coll").onchange = function () {
		collision = this.checked;
	};
	ops.$("#ac").onchange = function () {
		autoConnect = this.checked;
	};
	ops.$("#terrain").onchange = function () {
		if (this.checked) {
			createTerrain();
		} else {
			for (var i = points.length - 1; i >= 0; i--) {
				if (points[i].color == "green") {
					for (var j = connections.length - 1; j >= 0; j--) {
						var c = connections[j];
						if (c.p1 == points[i]) {
							connections.splice(j, 1);
						}
					}
					points.splice(i, 1);
				}
			}
		}
	};
	ops.$("#grav").onchange = function () {
		gravity = Number(this.value);
	};
	ops.$("#todo").onclick = function () {
		new Modal().title("Todo").content(""
			+ "<li>Precise connector tool</li>"
			+ "<li>Rope tool</li>"
			+ "<br>Ideally (but this would be hard), fix collision:"
			+ "<li>with self</li>"
			+ "<li>occasional no clip</li>"
		).position("top right");
	};
	ops.$("#help").onclick = function () {
		new Modal().title("Help").content(""
			+ "<p>Left Click to use the selected tool."
			+ "<br>Right Click to drag points."
			+ "<br>Use the glue tool or hold space near some points to connect them."
			+ "<br>Hold shift when making points to fix them in place."
			+ "<br>Toggle the 'terrain' to regenerate it. It only looks anything like terrain if you check AutoConnect"
			+ "<br>Press <kbd>P</kbd> to pause/unpause the simulation."
			+ "<br>Press <kbd>Z</kbd> to undo to a previous state and <kbd>Y</kbd> or <kbd>Shift+Z</kbd> to redo."
			+ "<br>Press <kbd>C</kbd> to copy the selection (or <kbd>X</kbd> to cut), and <kbd>V</kbd> to paste near the mouse."
			+ "<br>Press <kbd>Delete</kbd> to remove the selected points."
		).position("top");
	};
	ops.$("#resz").onclick = function () {
		new Modal().position("center").title("Resizable").content("Windows are collidable.").resizable();
	};
	var tools = new Modal().position("left").title("Tools").content(
		""
		+ "<button id='create-points'>Create Points (W)</button>"
		+ "<br>"
		+ "<button id='create-points-fast'>Create Points Quickly (Q)</button>"
		// + "<br>"
		// + "<button id='rope' disabled>Rope</button>"
		+ "<br>"
		+ "<button id='glue'>Glue (G)</button>"
		+ "<br>"
		// + "<button id='connector' disabled>Precise Connector</button>"
		// + "<br>"
		+ "<button id='selection'>Select (S)</button>"
	);

	var toolbuttons = tools.$$("button");

	selectTool = function(id) {
		tool = id;
		for (var i = 0; i < toolbuttons.length; i++) {
			var tb = toolbuttons[i];
			if (tb.id === id) {
				tb.classList.add("selected");
			} else {
				tb.classList.remove("selected");
			}
		}
	};

	selectTool(tool);
	for (var i = 0; i < toolbuttons.length; i++) {
		var tb = toolbuttons[i];
		tb.onclick = function () {
			selectTool(this.id);
		};
	}
}

main();
guiStuff();
