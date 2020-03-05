import React, { Component } from 'react';
import RecorderJS from './Recorder';

import { getAudioStream, exportBuffer } from '../utilities/audio';

class Recorder_old extends Component {
  constructor(props) {
    super(props);
    this.state = {
      stream: null,
      recording: false,
      recorder: null
    };
    this.token="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJleHAiOjE1ODc4MzY5MDAsIm5iZiI6MTU4MjY1MjkwMCwiaWF0IjoxNTgyNjUyOTAwLCJpc3MiOiJodHRwczovL2FjY291bnRzLmFtZXJhbmRpc2guY29tIiwiZXh0Ijp7InNydiI6IjBlNGYxNjgwLWJmODgtNGVkYi04Yjc0LTU4MmI4MzBhNzk2NCJ9LCJzdWIiOiJrMjI4Iiwic2NwIjpbImFzciIsImFzci9wb3N0IiwiYXNyL2xvbmciLCJhc3IvbGl2ZSIsImxtdCIsInR0cyIsInJlZnJlc2giXX0.1twU5X_FTPUQAyKyNGnHd7abCbtfAfuA-7gApN57m47v0rl4f7hGy47Vs3vb4urJt87B1QHdhSzqPGiItDoWrJmAHZ7BMvVXZrnysj-2UsBP8UuFevI74wNZRVM4wHbUpwHTLaAWusckV8e_wrmUcOJo7tCFvpvLfchq4XpW-C1iLqmSMPzFr9yP_UQwvC7AU7-6mcs2jXWG4iJE5w9acxWjMngFwL4yL9SnhM1Flwqonx4we9ZcceVJYQb0mDBPTnP1VVN_UrjRTJhIjZ4YYdezCUwtjKsaAevog0x_-VXnk_Fc40Nr49xpG0aLn46857KW23ENZwLCSLjTp1HQS-sNqOryqUq2Gv6vB7ccDaN6-fFmzXxVTz2E3yc8FLgd1549Ne802i_J5tsgh0gKh55m67CXdr-OFci2ZKuN5ttVoYzQ02O75MPYSUgV7SND3Mqh06kkkpoqeRPaPZIYcnZgl9QPJ9NIkvVRdjjV9pi5sjzdiuKaHHU3FZiEmCO76hSx8_03TUEYRkcxPGZiHXrPl-60I6ZxLK_dhjPPcYsnP21ZY7Z8HM1HGC8r-NcIIGEIP9kMYIR_XMf6dW8qEy8w_pG28bptJf5OoQXjVOIsoigITZqGu_bj0T2hEZDtGE7q2Wg26cxxbdbYSZ87GsZtxDrcDzQP_8LpxHrv2Uk";

    this.startRecord = this.startRecord.bind(this);
    this.stopRecord = this.stopRecord.bind(this);
    this.dataAvailable = this.dataAvailable.bind(this);
  }

  async componentDidMount() {
    let stream;

    // try {
    //   stream = await getAudioStream();
    // } catch (error) {
    //   // Users browser doesn't support audio.
    //   // Add your handler here.
    //   console.log(error);
    // }
    //
    // this.setState({ stream });
  }

  dataAvailable=(buffer)=>{
    const audioBlob = exportBuffer(buffer[0]);
    var reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = ()=> {
      // let data=new Uint8Array(reader.result)
      // ws.send(data)

      // console.log(reader.result);
      let base64data = reader.result.split(",")[1];
      // console.log( _convertB642AB(base64data))
      let arrayBuffer= this._convertB642AB(base64data);
      this.ws.send(arrayBuffer);
      console.log(3)
      // this.ws.send(arrayBuffer)
    };
  };

   _convertB642AB=(b64Data)=> {

    const byteCharacters = b64Data;



    var arrayBuffer = new ArrayBuffer(byteCharacters.length);

    var byteNumbers = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteCharacters.length; i++) {

      byteNumbers[i] = byteCharacters.charCodeAt(i);

    }



    return byteNumbers;

  }



  startRecord() {

    this.ws = new WebSocket(`wss://api.amerandish.com/v1/speech/asrlive?jwt=${this.token}`);

    // websocket onopen event listener
    this.ws.onopen = ()=> {
      console.log("connected websocket main component");
      const recorder = new RecorderJS({
        bufferLen: 4096,
        numChannels: 2,
        mimeType: 'audio/wav',
        dataAvailable:this.dataAvailable
      });
      // recorder.init(stream);

      this.setState(
          {
            recorder,
            recording: true
          },
          () => {
            recorder.record();
          }
      );

      this.interval= setInterval(()=>{
        recorder.getBuffer(buffer=>{
          const audioBlob = exportBuffer(buffer[0]);
          var reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = ()=> {
            // let data=new Uint8Array(reader.result)
            // ws.send(data)

            // console.log(reader.result);
            let base64data = reader.result.split(",")[1];
            // console.log( _convertB642AB(base64data))
            let arrayBuffer= this._convertB642AB(base64data);
            this.ws.send(arrayBuffer);
            console.log(3)
            // this.ws.send(arrayBuffer)
          };
        })
      },1500)

    };

    // websocket onclose event listener
    this.ws.onclose =function(e) {
      console.log(
          `Socket is closed.`,
          e
      );

    };

    this.ws.onmessage=function (ev){
      console.log(JSON.parse(ev.data).results[0].transcript)
    };
    // websocket onerror event listener
    this.ws.onerror = function(err){
      console.error(
          "Socket encountered error: ",
          err.message,
          "Closing socket"
      );

      this.ws.close();
    };
  }

  async stopRecord() {
    const { recorder } = this.state;

    recorder.stop()
    clearInterval(this.interval)
    // const audio = exportBuffer(buffer[0]);

    // Process the audio here.
    // console.log(audio);

    this.setState({
      recording: false
    });
  }

  render() {
    const { recording, stream } = this.state;

    // // Don't show record button if their browser doesn't support it.
    // if (!stream) {
    //   return null;
    // }

    return (
      <button
        onClick={() => {
          recording ? this.stopRecord() : this.startRecord();
        }}
        >
        {recording ? 'Stop Recording' : 'Start Recording'}
      </button>
    );
  }
}

export default Recorder_old;
