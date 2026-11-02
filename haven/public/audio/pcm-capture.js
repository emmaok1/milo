/* AudioWorklet: bounded 100ms PCM frames. No storage or network inside the worklet. */
class HavenPcmCapture extends AudioWorkletProcessor {
 constructor(){super();this.frames=Math.round(sampleRate/10);this.samples=new Float32Array(this.frames);this.offset=0;this.port.onmessage=e=>{if(e.data?.type==='reset')this.offset=0;};}
 process(inputs){const input=inputs[0]?.[0];if(input)for(let i=0;i<input.length;i++){
  this.samples[this.offset++]=input[i];if(this.offset===this.frames){const pcm=new ArrayBuffer(this.frames*2),view=new DataView(pcm);let sum=0;
   for(let j=0;j<this.frames;j++){const value=Math.max(-1,Math.min(1,this.samples[j]));sum+=value*value;view.setInt16(j*2,Math.round(value*(value<0?32768:32767)),true);}
   this.port.postMessage({pcm,rms:Math.sqrt(sum/this.frames)},[pcm]);this.offset=0;
  }
 }return true;}
}
registerProcessor('haven-pcm-capture',HavenPcmCapture);
