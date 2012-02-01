/**
 * WebSocketFileTransfer
 * This is a small library
 * @name WebSocketFileTransfer.js
 * @author Vincent Dieltiens - www.vincentdieltiens.be
 * @version DEV-0.1
 * @date January 30 2012
 * @license MIT
 */
 
/**
 * Class that represents a Progress Event
 */
var WebSocketFileTransferEvent = new Class({
	/**
	 * Initialize an event object
	 * @param source: the source of this event (a.k.a the creator)
	 * @param file: the related file
	 * @param loaded: the number of bytes loaded
	 * @param total: the total of bytes
	 * @param startTime: the time at which the transfer has began
	 */
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
	// The source of this event
	source: null,
	// The number of loaded and total bytes
	loaded: 0,
	total: 0,
	// The percentage of the
	percentage: 0,
	// The times
	startTime: null,
	elapsedTime: null,
	remainingTime: '',
	// The computed speed
	speed: '',
	// The related file
	file: null,
});

/**
 * Ads a general slice to the File prototype.
 * This method just returns the result of File.webkitSlice or File.mozSlice according to the browser
 * @param start: the starting byte
 * @param length: the number of bytes to slice
 */
File.prototype.slice = function(start, length) {
	if( this.webkitSlice ) {
		return this.webkitSlice(start, length);
	} else if( this.mozSlice ) {
		return this.mozSlice(start, length);
	}
}

/**
 * The upload client
 */
var WebSocketFileTransfer = new Class({
	Implements: [Options, Events],
	options: {
		// The default number of bytes to send by block
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
		},
		type: 'base64' // ['base64', 'binary']
	},
	/**
	 * Creates an object to upload a file
	 * @param options: the options
	 */
	initialize: function(options) {
		if( 'file' in options ) {
			this.setFile(options.file);
		}
		
		if( this.options.type != 'base64' && this.options.type  != 'binary') {
			throw new Error("type must be 'base64' or 'binary'");
		}
		
		this.setOptions(options);
	},
	/**
	 * Update the file of this client
	 * @param file: the new file
	 */
	setFile: function(file) {
		this.file = file;
	},
	/**
	 * Starts the upload of the file through a socket
	 */
	start: function(login, password) {
		var self = this;
		
		var login = (typeof(login) == "undefined") ? null: login;
		var password = (typeof(password) == "undefined") ? null: password;
		
		this.socket = this.createSocket(self.options.url);
		
		if( this.options.type == 'binary' ) {
			this.socket.binaryType = 'blob';
		}
		
		this.socket.onopen = function(event) {
			self.onOpen(event, login, password);
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
	/**
	 * Handler called when the connection with the socket is opened
	 * This handler call the onOpen handler defined in options and initialize the upload
	 * @param event: the event
	 * @param login: 
	 * @param password:
	 */
	onOpen: function(event, login, password) {
	
		if( typeof(this.options.onOpen) == 'function' ) {
			this.options.onOpen(event);
		}
		
		if( login != null && password != null ) {
			this.useAuth = true;
			this.sendAuth(login, password);
		} else {
			this.initializeUpload();
		}
		
	},
	/**
	 * Handler called when a new message is received from the web socket
	 * This handler parse the response. Two alternatives:
	 *   1/ The response is a response to a STOR command.
	 * 			If the response code is 200, we read the first block from the
	 *			file and send it to the socket.
	 *	 2/ The response is a response to a DATA command.
	 *			If the response code is 200, we send a progress event. 
	 *			If the all the data has been sent, we also send a success event,
	 *			If not all the data has been sent, we read and send the next block of data
	 * @param event: the event
	 */
	onMessage: function(event) {
		var self = this;
		
		response = self.parseResponse(event.data);
		
		if( response.code != 200 ) {
			var error = {
				message: response.message,
				code: response.code
			}
			self.onError(error);
			return false;
		}
		
		if( response.type == 'AUTH' ) {
			self.initializeUpload();
		} else if( response.type == 'STOR' ) {
			// Response to a STOR command.
			self.startTime = (new Date().getTime())/1000.0;
			self.readSlice(0, this.options.blockSize);
			
		} else if( response.type == 'DATA' ) {
			// Response to a DATA command.
			// Copy object informations into local var to have the 
			var curIndex = self.curIndex;
			var lastBlock = self.lastBlock;
			
			// Send an asynchrone event to notify that some data has been sent
			setTimeout(function() {
				var e = new WebSocketFileTransferEvent(self, self.file, curIndex + response.bytesRead, self.file.size, self.startTime);
				if( typeof(self.options.progress) == 'function' ) {
					self.options.progress(e);
				}
			}, 0);
			
			// If all the data has been sent, send an asynchrone success event 
			if( lastBlock ) {
			
				setTimeout(function() {
					var e = new WebSocketFileTransferEvent(self, self.file, curIndex + response.bytesRead, self.file.size, self.startTime);
					if( typeof(self.options.success) == 'function' ) {
						self.options.success(e);
					}
				}, 0);
			
				// Close the connection
				self.socket.close();
				return;
			}
		
			// Read and send the next block
			self.readSlice(self.curIndex + this.options.blockSize, this.options.blockSize);
			
		} else {
			var error = {
				message: "Response not understood",
				code: 0
			}
			self.onError(error);
			return false;
		}
		
		//readSlice(curIndex, this.options.blockSize);
	},
	/**
	 * Handler called when a websocket error has occured
	 * @param event: the event
	 */
	onError: function(event) {
		var self = this;
		self.socket.close();
		
		if( typeof(self.options.error) == 'function' ) {
			self.options.error(event);
		}
	},
	/**
	 * Handler called when the web socket server close the connection
	 * @param event: the event
	 */
	onClose: function(event) {
		var self = this;
		if( typeof(self.options.close) == 'function' ) {
			self.options.close(event);
		}
	},
	/**
	 * parse the server response
	 * @param response: the response to parse
	 * @return the response as an JS object/array
	 */
	parseResponse: function(response) {
		return JSON.decode(response);
	},
	/**
	 * Initialize the upload...
	 * ... by sending the STOR command to the server
	 */
	initializeUpload: function() {
	
		var infos = {
			'filename': this.file.name,
			'size': this.file.size,
			'type': this.options.type,
			'parameters': []
		};
		
		this.socket.send('STOR: '+JSON.encode(infos));
		
	},
	/**
	 * Send the AUTH command to the server to authenticate the user
	 * @param login: the login
	 * @param password: the password
	 */
	sendAuth: function(login, password) {
		
		var infos = {
			'login': login,
			'password': password
		};
		
		this.socket.send('AUTH: '+JSON.encode(infos));
		
	},
	/**
	 * Read the block of data starting at the start index with the given number of data
	 * and send it to the web socket
	 * @param start: the stating index
	 * @param length: the number of bytes to read and send
	 */
	readSlice: function(start, length) {
		var self = this;
		
		// Updates the current index
		self.curIndex = start;
		
		// Make sure we stop at end of file
		var stop = Math.min(start + length - 1, self.file.size-1);
		var length = stop - start + 1;
		
		// Save if it is the last block of data to send
		self.lastBlock = (stop == self.file.size-1);
		
		// Get blob and check his size
		var blob = self.file.slice(start, start+length);
		if( blob.size != length ) {
			throw new Error("slice fail !: slice result size is "+blob.size+". Expected: "+length);
		}
		
		if( self.options.type == 'binary' ) {
			self.sendSlice(blob);
			return;
		}
		
		// Creates the reader only for base 64 encoded data
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
			// When the block of data is read, send it to the socket (as a base 64 string)
			self.sendB64Slice(event.target.result);
		};
		
		// Read the file/blob
		self.reader.readAsBinaryString(blob);
	},
	/**
	 * Send the block of bindary data to the socket
	 * @param data: the block of data to send
	 */
	sendSlice: function(data) {
		this.socket.send(data);
	},
	/**
	 * Send the block of data to the socket as a base64 string
	 * @param data: the block of data to send
	 */
	sendB64Slice: function(data) {
		this.socket.send(window.btoa(data));
	},
	/**
	 * Creates the socket according to the browser
	 * @param url: the url of the web socket
	 * @return the url
	 */
	createSocket: function(url) {
		if( 'WebSocket' in window ) {
			return new WebSocket(url);
		} else if( 'MozWebSocket' in window ) {
			return new MozWebSocket(url);
		}
	},
	// The web socket
	socket: null,
	// The file reader
	reader: null,
	// The current index in the file
	curIndex: 0,
	// The last block to send or not
	lastBlock: false,
	// 
	startTime: null,
	// Use Authentification or not
	useAuth: false
});

/**
 * Is The File API supported ?
 * @return true if the API is supported
 */
WebSocketFileTransfer.fileAPISupported = function() {
	return 'File' in window && 'FileReader' in window && 'FileList' in window && 'Blob' in window;
};

/**
 * Is WebSocket supported on this browser ?
 * @return true if Web sockets are supported
 */
WebSocketFileTransfer.socketSupported = function() {
	return 'WebSocket' in window || 'MozWebSocket' in window;
};

/** 
 * Is This client supported
 * @return true if this client supported by the browser
 */
WebSocketFileTransfer.supported = function() {
	return WebSocketFileTransfer.socketSupported() && WebSocketFileTransfer.fileAPISupported();
};

// If Browser feature of Mootools is loaded, we can test the browser's version
// to guess if the binary is supported by the browser
if( Browser ) {

	/**
	 * Is binary supported by the client ?
	 * @return true if binary is supported
	 */
	WebSocketFileTransfer.binarySupported = function() {
		return Browser.chrome16;
	}
}