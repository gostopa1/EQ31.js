/* Copyright 2013 Chris Wilson

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();
var audioInput = null,
    realAudioInput = null,
    inputPoint = null,
    audioRecorder = null;
var rafID = null;
var analyserContext = null;
var canvasWidth, canvasHeight;
var recIndex = 0;

/* TODO:

- offer mono option
- "Monitor input" switch
*/

function saveAudio() {
    audioRecorder.exportWAV( doneEncoding );
    // could get mono instead by saying
    // audioRecorder.exportMonoWAV( doneEncoding );
}

function gotBuffers( buffers ) {
    var canvas = document.getElementById( "wavedisplay" );

    drawBuffer( canvas.width, canvas.height, canvas.getContext('2d'), buffers[0] );

    // the ONLY time gotBuffers is called is right after a new recording is completed - 
    // so here's where we should set up the download.
    audioRecorder.exportWAV( doneEncoding );
}

function doneEncoding( blob ) {
    Recorder.setupDownload( blob, "myRecording" + ((recIndex<10)?"0":"") + recIndex + ".wav" );
    recIndex++;
}

function toggleRecording( e ) {
    if (e.classList.contains("recording")) {
        // stop recording
        audioRecorder.stop();
        e.classList.remove("recording");
        audioRecorder.getBuffers( gotBuffers );
    } else {
        // start recording
        if (!audioRecorder)
            return;
        e.classList.add("recording");
        audioRecorder.clear();
        audioRecorder.record();
    }
}

function convertToMono( input ) {
    var splitter = audioContext.createChannelSplitter(2);
    var merger = audioContext.createChannelMerger(2);

    input.connect( splitter );
    splitter.connect( merger, 0, 0 );
    splitter.connect( merger, 0, 1 );
    return merger;
}

function cancelAnalyserUpdates() {
    window.cancelAnimationFrame( rafID );
    rafID = null;
}

function updateAnalysers(time) {
    if (!analyserContext) {
        var canvas = document.getElementById("analyser");
        canvasWidth = canvas.width;
        canvasHeight = canvas.height;
        analyserContext = canvas.getContext('2d');
		analyserContext2 = canvas.getContext('2d');
    }

    // analyzer draw code here
    {
        
        //var BAR_WIDTH = 20;
        //var numBars = Math.round(canvasWidth / SPACING);
		freqs=[20,25,31.5,40,50,63,80,100,125,180,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000,20000];
		freqst=["20","25","31.5","40","50","63","80","100","125","180","200","250","315","400","500","630","800","1k","1.25K","1.6K","2K","2.5K","3.15K","4K","5K","6.3K","8K","10K","12.5K","16K","20K"];
		stp=[1,3,4,5,6,7,9,11,14,18,22,27,33,42,53,66,83,105,131,165,209,261,327,414,521,653,827,1041,1301,1647,2081];
		enp=[2,3,4,5,6,8,10,13,17,21,26,32,41,52,65,82,104,130,164,208,260,326,413,520,652,826,1040,1300,1646,2080,5096];
		//numBars=32;
		numBars=stp.length;
		var BAR_WIDTH = Math.round(canvasWidth / numBars);
		var SPACING = BAR_WIDTH+1;
        var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);
		
		
        analyserNode.getByteFrequencyData(freqByteData); 
		
        analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
        analyserContext.fillStyle = '#FFFF00';
        analyserContext.lineCap = 'round';
        var multiplier = analyserNode.frequencyBinCount / numBars;
		//alert(freqByteData.length);
		

        // Draw rectangle for each frequency bin.
        for (var i = 1; i < numBars; ++i) {
            var magnitude = 0;
            var offset = Math.floor( i * multiplier );
			var divid=0;
            // gotta sum/average the block, or we miss narrow-bandwidth spikes
            //for (var j = 0; j< multiplier; j++){
			for (var j = stp[i]; j< enp[i]; j++){
				divid++;
                //magnitude += freqByteData[offset + j];
				magnitude += freqByteData[j];
				}
				magnitude=magnitude/divid;
            //magnitude = magnitude / multiplier;
			magnitude=magnitude*10;
            //var magnitude2 = freqByteData[i * multiplier];
            //analyserContext.fillStyle = "hsl( " + Math.round((i*360)/numBars) + ", 100%, 50%)";
            analyserContext.font="15px Georgia";
			//analyserContext.rotate(Math.PI*2);
			analyserContext.textAlign = "center";
			 analyserContext.restore();

			analyserContext.fillText(freqst[i+1],i * SPACING+BAR_WIDTH/2, canvasHeight*0.5, BAR_WIDTH,1000);
			
			//analyserContext.fillRect(i * SPACING, canvasHeight, BAR_WIDTH, -magnitude);
			analyserContext.fillRect(i * SPACING, canvasHeight, BAR_WIDTH, -magnitude);
			
			
        }
    }
    
    rafID = window.requestAnimationFrame( updateAnalysers );
}

function toggleMono() {
    if (audioInput != realAudioInput) {
        audioInput.disconnect();
        realAudioInput.disconnect();
        audioInput = realAudioInput;
    } else {
        realAudioInput.disconnect();
        audioInput = convertToMono( realAudioInput );
    }

    audioInput.connect(inputPoint);
}

function gotStream(stream) {
    inputPoint = audioContext.createGain();

    // Create an AudioNode from the stream.
    realAudioInput = audioContext.createMediaStreamSource(stream);
    audioInput = realAudioInput;
    audioInput.connect(inputPoint);

//    audioInput = convertToMono( input );

    analyserNode = audioContext.createAnalyser();
	analyserNode.smoothingTimeConstant=0.90;
    analyserNode.fftSize = 4096;
    inputPoint.connect( analyserNode );

    audioRecorder = new Recorder( inputPoint );

    zeroGain = audioContext.createGain();
    zeroGain.gain.value = 0.0;
    inputPoint.connect( zeroGain );
    zeroGain.connect( audioContext.destination );
    updateAnalysers();
}

function initAudio() {
        if (!navigator.getUserMedia)
            navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if (!navigator.cancelAnimationFrame)
            navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
        if (!navigator.requestAnimationFrame)
            navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

    navigator.getUserMedia(
        {
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream, function(e) {
            alert('Error getting audio');
            console.log(e);
        });
}

window.addEventListener('load', initAudio );
