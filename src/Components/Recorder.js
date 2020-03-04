import InlineWorker from 'inline-worker';

class Recorder {
    config = {
        bufferLen: 4096,
        numChannels: 2,
        mimeType: 'audio/wav'
    };

    recording = false;
    audio_context=null;
    source=null;

    callbacks = {
        getBuffer: [],
        exportWAV: []
    };

    constructor(cfg) {


        try {
            // webkit shim
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;
            window.URL = window.URL || window.webkitURL;

            this.audio_context = new AudioContext();
        } catch (e) {
            alert('No web audio support in this browser!');
        }

        navigator.getUserMedia({audio: true}, (stream)=>this.startUserMedia(stream,cfg), function(e) {

        });

    }

    mergeBuffers=(recBuffers, recLength) =>{
        let result = new Float32Array(recLength);
        let offset = 0;
        for (let i = 0; i < recBuffers.length; i++) {
            result.set(recBuffers[i], offset);
            offset += recBuffers[i].length;
        }
        return result;
    }


    startUserMedia=(stream,cfg)=>{
        console.log(cfg);
        this.source = this.audio_context.createMediaStreamSource(stream);
        Object.assign(this.config, cfg);
        this.context = this.source.context;
        this.node = (this.context.createScriptProcessor ||
            this.context.createJavaScriptNode).call(this.context,
            this.config.bufferLen, this.config.numChannels, this.config.numChannels);

        this.node.onaudioprocess = (e) => {
            if (!this.recording) return;

            let buffer = [];
            for (let channel = 0; channel < this.config.numChannels; channel++) {
                buffer.push(e.inputBuffer.getChannelData(channel));
            }

            let recLength = 0, recBuffers = [];
            for (let channel = 0; channel < this.config.numChannels; channel++) {
                recBuffers[channel] = [];
            }
            for (var channel = 0; channel < this.config.numChannels; channel++) {
                recBuffers[channel].push(buffer[channel]);
            }
            recLength += buffer[0].length;



            let buffers = [];
            for (let channel = 0; channel < this.config.numChannels; channel++) {
                buffers.push(this.mergeBuffers(recBuffers[channel], recLength));
            }

            //
            // let buffers = [];
            // for (let channel = 0; channel < this.config.numChannels; channel++) {
            //     buffers.push(this.config.numChannels(recBuffers[channel], recLength));
            // }

            this.config.dataAvailable(buffers)



        };

        this.source.connect(this.node);
        this.node.connect(this.context.destination);    //this should not be necessary

        let self = {};
        this.worker = new InlineWorker(function () {
            console.log(4)
            let recLength = 0,
                dataAvailable=null,
                recBuffers = [],
                sampleRate,
                numChannels;

            this.onmessage = function (e) {
                console.log(e)
                switch (e.data.command) {
                    case 'init':
                        init(e.data.config);
                        break;
                    case 'record':
                        record(e.data.buffer,e.data.mimeType);
                        break;
                    case 'exportWAV':
                        exportWAV(e.data.type,e.data.recLength,e.data.recBuffers);
                        break;
                    case 'getBuffer':
                        getBuffer();
                        break;
                    case 'clear':
                        clear();
                        break;
                }
            };

            function init(config) {
                sampleRate = config.sampleRate;
                numChannels = config.numChannels;
                dataAvailable=config.dataAvailable;
                initBuffers();
            }

            function record(inputBuffer,mimeType) {
                console.log(5)


                exportWAV(
                    mimeType,
                    recLength,
                    recBuffers
                );
            }

            function exportWAV(type,recLength,recBuffers) {
                console.log(2)
                let buffers = [];
                for (let channel = 0; channel < numChannels; channel++) {
                    buffers.push(mergeBuffers(recBuffers[channel], recLength));
                }
                let interleaved;
                if (numChannels === 2) {
                    interleaved = interleave(buffers[0], buffers[1]);
                } else {
                    interleaved = buffers[0];
                }
                let dataview = encodeWAV(interleaved);
                let audioBlob = new Blob([dataview], {type: type});

                var reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = ()=> {
                    // let data=new Uint8Array(reader.result)
                    // ws.send(data)

                    // console.log(reader.result);
                    var base64data = reader.result.split(",")[1];
                    // console.log( _convertB642AB(base64data))
                    let arrayBuffer= _convertB642AB(base64data);
                    console.log(arrayBuffer);
                    dataAvailable(arrayBuffer);
                    console.log(3)
                    // this.ws.send(arrayBuffer)
                };


                this.postMessage({command: 'exportWAV', data: audioBlob});
            }

            function _convertB642AB(b64Data) {

                const byteCharacters = b64Data;



                var arrayBuffer = new ArrayBuffer(byteCharacters.length);

                var byteNumbers = new Uint8Array(arrayBuffer);

                for (let i = 0; i < byteCharacters.length; i++) {

                    byteNumbers[i] = byteCharacters.charCodeAt(i);

                }



                return byteNumbers;

            }

            function getBuffer() {
                let buffers = [];
                for (let channel = 0; channel < numChannels; channel++) {
                    buffers.push(mergeBuffers(recBuffers[channel], recLength));
                }
                this.postMessage({command: 'getBuffer', data: buffers});
            }

            function clear() {
                recLength = 0;
                recBuffers = [];
                initBuffers();
            }

            function initBuffers() {
                for (let channel = 0; channel < numChannels; channel++) {
                    recBuffers[channel] = [];
                }
            }

            function mergeBuffers(recBuffers, recLength) {
                let result = new Float32Array(recLength);
                let offset = 0;
                for (let i = 0; i < recBuffers.length; i++) {
                    result.set(recBuffers[i], offset);
                    offset += recBuffers[i].length;
                }
                return result;
            }

            function interleave(inputL, inputR) {
                let length = inputL.length + inputR.length;
                let result = new Float32Array(length);

                let index = 0,
                    inputIndex = 0;

                while (index < length) {
                    result[index++] = inputL[inputIndex];
                    result[index++] = inputR[inputIndex];
                    inputIndex++;
                }
                return result;
            }

            function floatTo16BitPCM(output, offset, input) {
                for (let i = 0; i < input.length; i++, offset += 2) {
                    let s = Math.max(-1, Math.min(1, input[i]));
                    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                }
            }

            function writeString(view, offset, string) {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            }

            function encodeWAV(samples) {
                let buffer = new ArrayBuffer(44 + samples.length * 2);
                let view = new DataView(buffer);

                /* RIFF identifier */
                writeString(view, 0, 'RIFF');
                /* RIFF chunk length */
                view.setUint32(4, 36 + samples.length * 2, true);
                /* RIFF type */
                writeString(view, 8, 'WAVE');
                /* format chunk identifier */
                writeString(view, 12, 'fmt ');
                /* format chunk length */
                view.setUint32(16, 16, true);
                /* sample format (raw) */
                view.setUint16(20, 1, true);
                /* channel count */
                view.setUint16(22, numChannels, true);
                /* sample rate */
                view.setUint32(24, sampleRate, true);
                /* byte rate (sample rate * block align) */
                view.setUint32(28, sampleRate * 4, true);
                /* block align (channel count * bytes per sample) */
                view.setUint16(32, numChannels * 2, true);
                /* bits per sample */
                view.setUint16(34, 16, true);
                /* data chunk identifier */
                writeString(view, 36, 'data');
                /* data chunk length */
                view.setUint32(40, samples.length * 2, true);

                floatTo16BitPCM(view, 44, samples);

                return view;
            }
        }, self);

        let obj = JSON.parse(JSON.stringify({
            command: 'init',
            config: {
                sampleRate: 16000,//this.context.sampleRate,
                numChannels: this.config.numChannels,
                dataAvailable:this.config.dataAvailable
            }
        }));
        this.worker.postMessage(obj);

        this.worker.onmessage = (e) => {
            let cb = this.callbacks[e.data.command].pop();
            if (typeof cb == 'function') {
                cb(e.data.data);
            }
        };

    }


    record() {
        this.recording = true;
    }

    stop() {
        this.audio_context.close().then(()=> {
            this.source = null;
            this.node = null;
            this.audio_context = null;
        });
        this.recording = false;
    }

    clear() {
        this.worker.postMessage({command: 'clear'});
    }

    getBuffer(cb) {
        cb = cb || this.config.callback;
        if (!cb) throw new Error('Callback not set');

        this.callbacks.getBuffer.push(cb);

        this.worker.postMessage({command: 'getBuffer'});
    }

    exportWAV(cb, mimeType) {
        mimeType = mimeType || this.config.mimeType;
        cb = cb || this.config.callback;
        if (!cb) throw new Error('Callback not set');

        this.callbacks.exportWAV.push(cb);

        this.worker.postMessage({
            command: 'exportWAV',
            type: mimeType
        });
    }

    static
    forceDownload(blob, filename) {
        let url = (window.URL || window.webkitURL).createObjectURL(blob);
        let link = window.document.createElement('a');
        link.href = url;
        link.download = filename || 'output.wav';
        let click = document.createEvent("Event");
        click.initEvent("click", true, true);
        link.dispatchEvent(click);
    }
}

export default Recorder;
