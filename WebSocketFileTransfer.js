var WebSocketFileTransferEvent = new Class({
	initialize: function(source, file, loaded, total, startTime) {
		this.source = source;
		this.loaded = loaded;
		this.total = total;
		this.startTime = startTime;
		this.file = file;
		
		// Computes the time of upload
    	this.elapsedTime = (new Date().getTime())/1000 - this.startTime;

    	// Computes the average speed in o/s
    	this.speed = this.loaded / this.elapsedTime;

    	// Compute the average remaining Time
    	this.remainingTime = (this.elapsedTime / this.loaded) * (this.total - this.loaded);

    	// Compute the percentgae
    	this.percentage = parseInt((this.loaded / this.total) * 100);
	},
	source: null,
	loaded: 0,
	total: 0,
	percentage: 0,
	remainingTime: '',
	speed: '',
	startTime: null,
	elapsedTime: null,
	file: null
});

File.prototype.slice = function(start, length) {
	if( this.webkitSlice ) {
		return this.webkitSlice(start, length);
	} else if( this.mozSlice ) {
		return this.mozSlice(start, length);
	}
}

var WebSocketFileTransfer = new Class({
	Implements: [Options, Events],
	options: {
		blockSize: 1024,
		open: function(event) {
			this.fireEvent('onopen', event);
		},
		progress: function(event) {
			this.fireEvent('onprogress', event);
		},
		success: function(event) {
			this.fireEvent('onsuccess', event);
		},
		error: function(event) {
			this.fireEvent('onerror', event);
		}
	},
	initialize: function(options) {
		if( 'file' in options ) {
			this.setFile(options.file);
		}
		this.setOptions(options);
	},
	setFile: function(file) {
		this.file = file;
	},
	start: function() {
		var self = this;
		
		this.socket = this.createSocket(self.options.url);
		
		this.socket.onopen = function(event) {
			self.onOpen(event);
		}
		
		this.socket.onmessage = function(event) {
			self.onMessage(event);
		}
		
		this.socket.onerror = function(event) {
			self.onError(event);
		}
		
		this.socket.onclose = function(event) {
			self.onClose();
		}
	},
	onOpen: function(event) {
		if( typeof(this.options.onOpen) == 'function' ) {
			this.options.onOpen(event);
		}
		
		this.initializeUpload();
	},
	onMessage: function(event) {
		var self = this;
		
		response = self.parseResponse(event.data);
		
		if( response.type == 'STOR' ) {
			
			if( response.code == 200 ) {
				self.startTime = (new Date().getTime())/1000.0;
				self.readSlice(0, this.options.blockSize);
			}
			
		} else if( response.type == 'DATA' ) {
			
			var curIndex = self.curIndex;
			var lastBlock = self.lastBlock;
			
			setTimeout(function() {
				var e = new WebSocketFileTransferEvent(self, self.file, curIndex + response.bytesRead, self.file.size, self.startTime);
				if( typeof(self.options.progress) == 'function' ) {
					self.options.progress(e);
				}
			}, 0);
			
			if( self.lastBlock ) {
				
				setTimeout(function() {
					var e = new WebSocketFileTransferEvent(self, self.file, curIndex + response.bytesRead, self.file.size, self.startTime);
					if( typeof(self.options.success) == 'function' ) {
						self.options.success(e);
					}
				}, 0);
				
				self.socket.close();
				//delete self.socket;
				return;
			}
			
			if( response.code == 200 ) {
				self.readSlice(self.curIndex + this.options.blockSize, this.options.blockSize);
			}
			
		} else {
			alert('response not understood');
			console.log(response);
		}
		
		//readSlice(curIndex, this.options.blockSize);
	},
	onError: function(event) {
		console.log('error');
	},
	onClose: function(event) {
		console.log('close');
	},
	parseResponse: function(response) {
		return JSON.decode(response);
	},
	initializeUpload: function() {
		var infos = {
			'filename': this.file.name,
			'size': this.file.size,
			'parameters': []
		};
		this.socket.send('STOR: '+JSON.encode(infos));
	},
	readSlice: function(start, length) {
		var self = this;
		
		self.curIndex = start;
		
		// make sure we stop at end of file
		var stop = Math.min(start + length - 1, self.file.size-1);
		var length = stop - start + 1;
		
		var blob = self.file.slice(start, start+length);
		
		if( blob.size != length ) {
			throw new Error("slice fail ! : slice result size is "+blob.size+". Expected : "+length);
		}
		
		self.reader = new FileReader();
		
		self.reader.onabort = function() {
			console.log('reader: abort')
		};
		
		self.reader.onerror = function(event) {
			switch(event.target.error.code) {
      			case event.target.error.NOT_FOUND_ERR:
        			console.log('File not found');
       				break;
      			case event.target.error.NOT_READABLE_ERR:
        			console.log('File is not readable');
        			break;
      			case event.target.error.ABORT_ERR:
       				console.log('File upload aborted');
        			break;
      			default:
        			console.log('An error occurred reading the file.');
    		};
		};
		
		self.reader.onloadend = function(event) {
			self.sendB64Slice(event.target.result);
		};
		
		
		self.lastBlock = (stop == self.file.size-1);
		
		//self.sendBlob(blob);
		self.reader.readAsBinaryString(blob);
	},
	sendSlice: function(data) {
		this.socket.send(data);
	},
	sendBlob: function(blob) {
		this.socket.send(blob);
	},
	sendB64Slice: function(data) {
		this.socket.send(window.btoa(data));
	},
	/**
	 * Is The File API supported ?
	 * @return true if the API is supported
	 */
	fileAPISupported: function() {
		return 'File' in window && 'FileReader' in window && 'FileList' in window && 'Blob' in window;
	},
	/**
	 * Is WebSocket supported on this browser ?
	 * @return true if Web sockets are supported
	 */
	socketSupported: function() {
		return 'WebSocket' in window || 'MozWebSocket' in window;
	},
	/**
	 * Creates the socket according to the browser
	 * @param url : the url of the web socket
	 * @return the url
	 */
	createSocket: function(url) {
		if( 'WebSocket' in window ) {
			return new WebSocket(url);
		} else if( 'MozWebSocket' in window ) {
			return new MozWebSocket(url);
		}
	},
	/** 
	 * Is This client supported
	 * @return this if this client supported by the browser
	 */
	supported: function() {
		return this.socketSupported() && this.fileAPISupported();
	},
	commands: {
		'initialize': ''
	},
	socket: null,
	reader: null,
	curIndex: 0,
	lastBlock: false,
	startTime: null
});