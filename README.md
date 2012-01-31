# WebSocketFileTransfer

WebSocketFileTransfer is a small class which can send big files using web sockets and a web socket server.

This class use the Mootools's class system. You may include only the class file system and not all the mootools features (see the Installation section).

## Compatibility

WebSocketFileTransfer is only compatible with browsers that support the following features of HTML 5:

* [Web Sockets](http://caniuse.com/#feat=websockets)
* [File API](http://caniuse.com/#feat=fileapi)
* [File Reader](http://caniuse.com/#feat=filereader)
* Blob (included in File API ?)

## Installation & Usage

1. You must have a Web Socket server compatible with WebSocketFileTransfer. See the Server section for more details

2. You must first import the mootools class System. WebSocketFileTransfer requires at least this features from mootools:
	* Core
	* Event
	* Class
	* Class.Extras
	* JSON

	Here is the download link: http://mootools.net/core/d6edd91125b538672227900235ce1b56

3. Next, you have to include WebSocketFileTransfer.js

	<script src="sylesheet" href="mootools-core-1.4.3.js"></script>
	<script src="sylesheet" href="WebSocketFileTransfer.js"></script>

4. Create a WebSocketFileTransfer object for each File you want to upload to the web socket server and start the download

		var transfer = new WebSocketFileTransfer({
			url: 'ws://ip:port/path/to/upload_web_socket_server',
			file: files[i],
			progress: function(event) {
				// Update the progress bar
			},
			success: function(event) {
				// Do something
			}
		});

		transfer.start();

## Options

The WebSocketFileTransfer class accepts an dict of options as parameter.

this options can be:

	* **url**: the url of the server
	* **file**: the file to upload
	* **progress**: an handler to follow the progress of the upload
	* **success**: an handler called when the upload is finished
	* **open**: an handler called when the connection to the server is established
	* **close**: an handler called when the connection to the server is closed
	* **blockSize**: the size of packets to send. Default is 1024
	* **type**: the type of transfer : binary or base64. Default is 'base64'
	
The **url** and **file** are required.

The type of transfer supported by the major browsers is only 'base64'. At this time, only Chrome 16 (the current last version), support binary.
If you have loaded the **Browser** feature of Mootools, you can do this :

	var transfer = new WebSocketFileTransfer({
		...,
		type: WebSocketFileTransfer.binarySupported() ? 'binary' : 'base64',
	});

Note that, this is better to use binary because :

	1. You don't have to convert it to base64
	2. base64 encoding make data longer, so you have more data to upload.

## Server

You are free to use or implement any Web Socket server you want, in any which language you want. The only thing required is to support a specific API.

The WebSocketFileTransfer sends two types of message:

* **STOR [json_data]**
* **[base64_data]**

The server must respectively answser this:

* JSON response to STOR message:
	
		{
			"type": "STOR",
			"message": "Upload initialized. Wait for data",
			"code": 200
		}
	
Note that the message value can be changed

* JSON response to a DATA message

		{
			"type": "DATA",
			"code": 200,
			"bytesRead": numberOfBytesReceivedAndReadByTheServer
		}
		
You can find a example of PHP Web Sockets Server compatible with this client on my repositories:
	* [PhpWebSocketFileTransferServer](https://github.com/vincentdieltiens/PhpWebSocketFileTransferServer)
	* and his dependency [phpws](https://github.com/vincentdieltiens/phpws)

## Contact & Help

If you have questions, feel free to ask on my [Twitter](https://twitter.com/#!/and1hotsauce). Alternatively if you find a bug or have some improvement you can [open an issue](https://github.com/vincentdieltiens/WebSocketFileTransfer/issues)