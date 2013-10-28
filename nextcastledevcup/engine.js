(function(exports) {

// Класс графического движка.
var Engine = exports.Engine = function(canvas) {
    // контекст WebGL
	var contextAttributes = {
		alpha: false,
		depth: true,
		stencil: false,
		antialias: true
	};
	var gl = this.gl = canvas.getContext('webgl', contextAttributes) || canvas.getContext('experimental-webgl', contextAttributes);

	// инициализация
	gl.clearColor(0, 0, 0, 1);
	gl.enable(gl.CULL_FACE);
	gl.enable(gl.DEPTH_TEST);

	// очистить экран
	var clear = this.clear = function() {
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	};
	
	// установить viewport
	var updateViewport = this.updateViewport = function(width, height) {
	    gl.viewport(0, 0, width, height);
	};

	// Загрузить текстуру.
	var loadTexture = this.loadTexture = function(fileName, options, callback) {
		if (callback === undefined) {
			callback = options;
			options = {};
		}
		var image = new Image();
		image.onload = function() {
			// создать текстуру
			var texture = gl.createTexture();
			// загрузить в неё данные
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, options.alpha ? gl.RGBA : gl.RGB, options.alpha ? gl.RGBA : gl.RGB, gl.UNSIGNED_BYTE, image);
			if (options.mipmap)
				gl.generateMipmap(gl.TEXTURE_2D);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, options.linear ? gl.LINEAR : gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, options.mipmap ? (options.linear ? gl.NEAREST_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_NEAREST) : (options.linear ? gl.LINEAR : gl.NEAREST));
			gl.bindTexture(gl.TEXTURE_2D, null);

			// вернуть текстуру
			callback(texture);
		};
		image.src = fileName;
	};

	// Загрузить шейдер.
	var loadShader = function(shaderType, source) {
		var shader = gl.createShader(shaderType);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
			throw gl.getShaderInfoLog(shader);
		return shader;
	};

	var loadVertexShader = this.loadVertexShader = function(source) {
		return loadShader(gl.VERTEX_SHADER, source);
	};

	var loadPixelShader = this.loadPixelShader = function(source) {
		return loadShader(gl.FRAGMENT_SHADER, source);
	};

	// Загрузить программу.
	/* attributes: массив имён атрибутов - данных, передаваемых с вершиной.
	 * uniforms: массив глобальных переменных, вида:
	 * {
	 *   name: имя,
	 *   type: 'float', 'vec2', 'vec3', 'vec4', 'mat3', 'mat4' или 'texture'
	 * }
	 * Функция модифицирует массив uniforms, добавляя туда элементы.
	 */
	var loadProgram = this.loadProgram = function(vertexShader, pixelShader, attributes, uniforms) {
		var shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, pixelShader);
		gl.linkProgram(shaderProgram);
		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS))
			throw 'error linking program';

		var program = {
			// shader program
			p: shaderProgram,
			// attributes' locations
			a: {},
			// функция установки атрибутов
			// values - хеш значений для программы
			s: function(values) {
				for ( var i = 0; i < uniforms.length; ++i) {
					var uniform = uniforms[i];
					uniform.set(values[uniform.name]);
				}
			}
		};

		for ( var i = 0; i < attributes.length; ++i) {
			var attribute = attributes[i];
			program.a[attribute] = gl.getAttribLocation(shaderProgram, attribute);
		}

		// обработать глобальные переменные
		var textureCount = 0;
		for ( var i = 0; i < uniforms.length; ++i)
			(function(uniform, textureSlot) {
				var location = gl.getUniformLocation(shaderProgram, uniform.name);
				switch (uniform.type) {
				case 'float':
					uniform.set = function(value) {
						gl.uniform1f(location, value);
					};
					break;
				case 'vec2':
					uniform.set = function(value) {
						gl.uniform2fv(location, value);
					};
					break;
				case 'vec3':
					uniform.set = function(value) {
						gl.uniform3fv(location, value);
					};
					break;
				case 'vec4':
					uniform.set = function(value) {
						gl.uniform4fv(location, value);
					};
					break;
				case 'mat3':
					uniform.set = function(value) {
						gl.uniformMatrix3fv(location, false, value);
					};
					break;
				case 'mat4':
					uniform.set = function(value) {
						gl.uniformMatrix4fv(location, false, value);
					};
					break;
				case 'texture':
					var activeTextureNumber = gl.TEXTURE0 + textureSlot;
					uniform.set = function(value) {
						gl.activeTexture(activeTextureNumber);
						gl.bindTexture(gl.TEXTURE_2D, value);
						gl.uniform1i(location, textureSlot);
					};
					break;
				default:
					throw new Error('unknown uniform type');
				}
			})(uniforms[i], uniforms[i].type == 'texture' ? (textureCount++) : undefined);

		return program;
	};

	// Загрузить меш.
	/* floats: данные меша (объект Float32Array)
	 * attributes: массив атрибутов вида {
	 * 	name: имя атрибута
	 * 	size: количество float'ов в атрибуте
	 * }
	 * функция модифицирует массив attributes.
	 */
	var loadMesh = this.loadMesh = function(framesCount, floats, indices, attributes) {
		// создать вершинный буфер
		var vertexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		var floatsArray = new Float32Array(floats);
		var floatSize = floatsArray.BYTES_PER_ELEMENT;
		gl.bufferData(gl.ARRAY_BUFFER, floatsArray, gl.STATIC_DRAW);

		// создать индексный буфер
		var indexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
		var indicesArray = new Uint16Array(indices);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesArray, gl.STATIC_DRAW);

		// добавить каждому атрибуту поле смещения в байтах
		// заодно вычислить vertex stride во float'ах
		var stride = 0;
		for ( var i = 0; i < attributes.length; ++i) {
			var attribute = attributes[i];
			attribute.offset = stride * floatSize;
			stride += attribute.size;
		}
		// перевести stride в байты
		stride *= floatSize;
		// получить количество индексов
		var indicesCount = indices.length;
        
        // если это морфинговая модель, запилить хитрую функцию установки атрибутов
        var setAttributesFunc;
        if(framesCount > 1) {
            // получить дублирующие атрибуты
            var attributes1 = [], attributes2 = [];
            for(var i = 0; i < attributes.length; ++i) {
                var attribute = attributes[i];
                attributes1.push({
                    name: attribute.name + '1',
                    size: attribute.size,
                    offset: attribute.offset
                });
                attributes2.push({
                    name: attribute.name + '2',
                    size: attribute.size,
                    offset: attribute.offset
                });
            }
            // вычислить расстояние между кадрами
            var frameStride = (floats.length / framesCount) * floatSize;
            setAttributesFunc = function(locations, frame1, frame2) {
                // прицепить буфер
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
                frame1 *= frameStride;
                frame2 *= frameStride;
                // указать атрибуты
                for ( var i = 0; i < attributes1.length; ++i) {
                    var attribute = attributes1[i];
                    var location = locations[attribute.name];
                    gl.enableVertexAttribArray(location);
                    gl.vertexAttribPointer(location, attribute.size, gl.FLOAT, false, stride, attribute.offset + frame1);
                }
                for ( var i = 0; i < attributes2.length; ++i) {
                    var attribute = attributes2[i];
                    var location = locations[attribute.name];
                    gl.enableVertexAttribArray(location);
                    gl.vertexAttribPointer(location, attribute.size, gl.FLOAT, false, stride, attribute.offset + frame2);
                }
                // указать индексы
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            };
        } else
        setAttributesFunc = function(locations) {
			// прицепить буфер
			gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
			// указать атрибуты
			for ( var i = 0; i < attributes.length; ++i) {
				var attribute = attributes[i];
				var location = locations[attribute.name];
				gl.enableVertexAttribArray(location);
				gl.vertexAttribPointer(location, attribute.size, gl.FLOAT, false, stride, attribute.offset);
			}
			// указать индексы
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
		};

		var mesh = {
            fc: framesCount,
			// setting attributes func
			s: setAttributesFunc,
			// draw
			d: function() {
				gl.drawElements(gl.TRIANGLES, indicesCount, gl.UNSIGNED_SHORT, 0);
			}
		};
		return mesh;
	};

	// вспомогательная функция - загрузить двоичные данные из картинки
	var loadPackedData = function(fileName, callback) {
		var image = new Image();
		image.onload = function() {
			var canvas = document.createElement('canvas');
			var width = canvas.width = image.width;
			var height = canvas.height = image.height;
			var context = canvas.getContext('2d');
			context.drawImage(image, 0, 0);

			// разобрать данные из картинки
			// картинка формата RGBA, причём A не используется (установлен в 255)
			// см. кодирование в build/meshes.js
			var imageData = context.getImageData(0, 0, width, height);
			var imageDataData = imageData.data;
			var dataSize = imageDataData.length / 4 * 3;
			var buffer = new ArrayBuffer(dataSize);
			var bufferView = new Uint8Array(buffer);
			var j = 0;
			for ( var i = 0; i < dataSize;) {
				for ( var k = 0; k < 3 && i < dataSize; ++k)
					bufferView[i++] = imageDataData[j++];
				j++;
			}
			callback(buffer);
		};
		image.src = fileName;
	};

	// загрузить упакованный меш из картинки
	var loadPackedMesh = this.loadPackedMesh = function(fileName, attributes, callback) {
		loadPackedData(fileName, function(buffer) {
			var headerView = new Uint32Array(buffer, 0, 3);
            var framesCount = headerView[0];
			var verticesCount = headerView[1];
			var indicesCount = headerView[2];

			var vertices = new Float32Array(buffer, 12, verticesCount);
			var indices = new Uint16Array(buffer, 12 + verticesCount * 4, indicesCount);

			callback(loadMesh(framesCount, vertices, indices, attributes));
		});
	};

	// Нарисовать программой меш, с заданными параметрами.
	var draw = this.draw = function(program, mesh, uniforms) {
		// установить все атрибуты
		mesh.s(program.a);
		// указать программу
		gl.useProgram(program.p);
		// задать глобальные переменные
		program.s(uniforms);
		// нарисовать меш
		mesh.d();
	};

	/* создать меш для ландшафта, по карте высот
	 * меш создаётся в квадрате (0,0)-(1,1), с высотами в [0,1]
	 */
	var loadTerrain = this.loadTerrain = function(map, callback) {
		// загрузить картинку
		var image = new Image();
		image.onload = function() {
			var canvas = document.createElement('canvas');
			var width = canvas.width = image.width;
			var height = canvas.height = image.height;
			var context = canvas.getContext('2d');
			context.drawImage(image, 0, 0);

			var imageData = context.getImageData(0, 0, width, height);
			var imageDataData = imageData.data;

			var size = width * height;

			// создать данные вершин
			var vertices = [];
			var k = 0;
			for ( var i = 0; i < height; ++i)
				for ( var j = 0; j < width; ++j) {
					vertices.push(j / (width - 1));
					vertices.push(i / (height - 1));
					vertices.push(imageDataData[k++ * 4] / 255);
					// occlusion
					vertices.push(0);
				}
			// создать индексы
			var indices = [];
			for ( var i = 1; i < height; ++i)
				for ( var j = 1; j < width; ++j) {
					indices.push((i - 1) * width + (j - 1));
					indices.push((i - 1) * width + j);
					indices.push(i * width + j);
					indices.push((i - 1) * width + (j - 1));
					indices.push(i * width + j);
					indices.push(i * width + (j - 1));
				}
			var terrainScaleX = map.terrainScale[0];
			var terrainScaleY = map.terrainScale[1];
			var terrainScaleZ = map.terrainScale[2];
			// вычисление телесного угла для треугольника (c = (0,0,1) всегда)
			var csa = function(ax, ay, az, bx, by, bz) {
				ax *= terrainScaleX;
				ay *= terrainScaleY;
				az *= terrainScaleZ;
				bx *= terrainScaleX;
				by *= terrainScaleY;
				bz *= terrainScaleZ;
				// 2 * atan( dot(a,cross(b,c)) / (|a||b||c| + dot(a,b)|c| + dot(b,c)|a| + dot(c,a)|b|) )
				var la = Math.sqrt(ax * ax + ay * ay + az * az);
				var lb = Math.sqrt(bx * bx + by * by + bz * bz);
				// lc = 1
				// cross(b,c) = (by,-bx,0)
				// dot(a,cross(b,c)) = ax*by-ay*bx
				return 2 * Math.atan((ax * by - ay * bx) / (la * lb + (ax * bx + ay * by + az * bz) + bz * la + az * lb));
			};
			// получение высоты точки по координатам
			var getHeight = function(x, y) {
				var xx = Math.floor(x);
				var xxx = x - xx;
				var yy = Math.floor(y);
				var yyy = y - yy;
				var z00 = vertices[(yy * width + xx) * 4 + 2];
				var z01 = vertices[(yy * width + (xx + 1)) * 4 + 2];
				var z10 = vertices[((yy + 1) * width + xx) * 4 + 2];
				var z11 = vertices[((yy + 1) * width + (xx + 1)) * 4 + 2];
				if (xxx > yyy) {
					return (z00 * (1 - xxx) + z01 * xxx) * (1 - yyy) + (z00 * (1 - xxx) + z11 * xxx) * yyy;
				} else {
					return (z00 * (1 - yyy) + z10 * yyy) * (1 - xxx) + (z00 * (1 - yyy) + z11 * yyy) * xxx;
				}
			};
			var lightDirection = vec3.create(map.lightDirection);
			// здесь, возможно, должна быть коррекция lightDirection с terrainScale
			vec3.normalize(lightDirection);
			var ambient = map.ambient;
			var stepCount = Math.max(width, height);
			vec3.scale(lightDirection, 1 / stepCount);
			var a = vec3.create(), b = vec3.create();
			// вычислить occlusion для внутренних точек
			for ( var i = 1; i < height - 1; ++i)
				for ( var j = 1; j < width - 1; ++j) {
					// получить шесть точек, которые участвуют в шести треугольниках
					var z00 = vertices[(i * width + j) * 4 + 2];
					var z_1_1 = vertices[((i - 1) * width + (j - 1)) * 4 + 2] - z00;
					var z_10 = vertices[((i - 1) * width + j) * 4 + 2] - z00;
					var z0_1 = vertices[(i * width + (j - 1)) * 4 + 2] - z00;
					var z01 = vertices[(i * width + (j + 1)) * 4 + 2] - z00;
					var z10 = vertices[((i + 1) * width + j) * 4 + 2] - z00;
					var z11 = vertices[((i + 1) * width + (j + 1)) * 4 + 2] - z00;
					// вычислить телесный угол
					var s = 0;
					s += csa(-1, -1, z_1_1, 0, -1, z_10);
					s += csa(0, -1, z_10, 1, 0, z01);
					s += csa(1, 0, z01, 1, 1, z11);
					s += csa(1, 1, z11, 0, 1, z10);
					s += csa(0, 1, z10, -1, 0, z0_1);
					s += csa(-1, 0, z0_1, -1, -1, z_1_1);
					// записать его
					s /= Math.PI * 2;
					s = s * s;// для усиления эффекта
					s = s * s;
					s = s * s;
					s = s * s;

					// плюс ещё рассчитать тень
					a[0] = j / (width - 1);
					a[1] = i / (height - 1);
					a[2] = z00;
					vec3.add(a, lightDirection);
					for ( var k = 1; k < stepCount && a[0] > 0 && a[0] < 1 && a[1] > 0 && a[1] < 1; ++k, vec3.add(a, lightDirection))
						if (getHeight(a[0] * (width - 1), a[1] * (height - 1)) > a[2]) {
							s *= ambient;
							break;
						}

					vertices[(i * width + j) * 4 + 3] = s;
				}

			// вернуть меш
			callback({
			    mesh: loadMesh(1, vertices, indices, [{
				    name: 'aPosition',
				    size: 3
			    }, {
    				name: 'aOcclusion',
	    			size: 1
		    	}]),
		    	getHeight: getHeight
		    });
		};
		image.src = map.terrainHeightmap;
	};

    // Нарисовать программой морфируемый меш, с заданными параметрами.
	var drawMorphed = this.drawMorphed = function(program, mesh, uniforms, time) {
        time *= (mesh.fc - 1);
        var frame1 = Math.floor(time);
		// установить все атрибуты
		mesh.s(program.a, frame1, frame1 + 1);
        // установить uniform
        uniforms.uStep = time - frame1;
		// указать программу
		gl.useProgram(program.p);
		// задать глобальные переменные
		program.s(uniforms);
		// нарисовать меш
		mesh.d();
	};

	// включить/отключить режим спрайтов
	var spriteMode = this.spriteMode = function(enable) {
		if (enable) {
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			gl.disable(gl.DEPTH_TEST);
		} else {
			gl.disable(gl.BLEND);
			gl.enable(gl.DEPTH_TEST);
		}
	};

	// включить/отключить режим билбордов
	var billboardMode = this.billboardMode = function(enable) {
		if (enable) {
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			gl.depthMask(false);
		} else {
			gl.disable(gl.BLEND);
			gl.depthMask(true);
		}
	};
    
    var additiveBlendingMode = this.additiveBlendingMode = function(enable) {
        if(enable) {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        } else {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
    };

	// включить/отключить смешивание
	var blending = this.blending = function(enable) {
		if (enable) {
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		} else {
			gl.disable(gl.BLEND);
		}
	};
};

})(window.engine = {});
