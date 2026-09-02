/**
 * Aplicativo Analisador de Espectro & Frequências Terapêuticas
 * Vanilla JS + Web Audio API + HTML5 Canvas
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Upload & Dropzone
  const audioFileInput = document.getElementById('audio-file');
  const dropzone = document.getElementById('dropzone');
  const fileLabelText = document.getElementById('file-label-text');

  // DOM Elements - Player Section
  const playerSection = document.getElementById('player-section');
  const trackName = document.getElementById('track-name');
  const trackTime = document.getElementById('track-time');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const btnPlayPause = document.getElementById('btn-play-pause');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const btnStop = document.getElementById('btn-stop');
  const volumeSlider = document.getElementById('volume-slider');

  // DOM Elements - Visualizer
  const canvas = document.getElementById('visualizer-canvas');
  const canvasCtx = canvas.getContext('2d');
  const canvasPlaceholder = document.getElementById('canvas-placeholder');
  const chipButtons = document.querySelectorAll('.visualizer-modes .btn-chip');

  // DOM Elements - Pitch Shifter
  const pitchPresets = document.querySelectorAll('.pitch-preset-buttons .btn-preset');
  const pitchSlider = document.getElementById('pitch-slider');
  const pitchValDisplay = document.getElementById('pitch-val-display');

  // DOM Elements - Solfeggio Tone Generator
  const toneToggle = document.getElementById('tone-toggle');
  const solfeggioBtns = document.querySelectorAll('.btn-solfeggio');
  const customFreqInput = document.getElementById('custom-freq-input');
  const btnApplyCustomFreq = document.getElementById('btn-apply-custom-freq');
  const toneVolSlider = document.getElementById('tone-vol-slider');
  const toneVolDisplay = document.getElementById('tone-vol-display');

  // DOM Elements - Export
  const btnExportAudio = document.getElementById('btn-export-audio');
  const exportStatus = document.getElementById('export-status');
  const exportSpinner = document.getElementById('export-spinner');
  const exportStatusText = document.getElementById('export-status-text');

  // Audio Context & Nodes State
  let audioCtx = null;
  let audioBuffer = null;
  let sourceNode = null;
  let masterGainNode = null;
  let analyserNode = null;

  // Tone Generator Nodes State
  let toneOscillator = null;
  let toneGainNode = null;
  let isToneEnabled = false;
  let currentToneFreq = 432;
  let currentToneVol = 0.15;

  // Playback State
  let isPlaying = false;
  let startTime = 0;
  let pausedAt = 0;
  let currentFileName = 'audio';
  let targetReferenceFreq = 440; // Target tuning base (Hz)
  let visualizerMode = 'bars'; // 'bars', 'wave', 'dual'
  let animationFrameId = null;

  // Initialize Canvas Resolution
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvasCtx.scale(dpr, dpr);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Lazy Initialization of AudioContext
  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // --- FILE SELECTION & LOADING ---
  audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleSelectedFile(file);
  });

  // Drag and drop handlers
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      handleSelectedFile(file);
    }
  });

  function handleSelectedFile(file) {
    currentFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    fileLabelText.textContent = file.name;

    stopAudio();
    audioBuffer = null;

    const reader = new FileReader();
    fileLabelText.textContent = 'Carregando arquivo...';

    reader.onload = async (event) => {
      try {
        const ctx = getAudioContext();
        fileLabelText.textContent = 'Decodificando áudio...';
        audioBuffer = await ctx.decodeAudioData(event.target.result);

        fileLabelText.textContent = file.name;
        playerSection.classList.remove('hidden');
        btnExportAudio.disabled = false;
        canvasPlaceholder.classList.add('hidden');

        updateTimeDisplay();
      } catch (err) {
        console.error('Erro ao decodificar áudio:', err);
        alert('Não foi possível ler o arquivo de áudio fornecido. Tente outro arquivo MP3/WAV.');
        fileLabelText.textContent = 'Escolher Arquivo de Áudio';
      }
    };

    reader.readAsArrayBuffer(file);
  }

  // --- AUDIO PLAYBACK ENGINE ---
  function setupAudioNodes() {
    const ctx = getAudioContext();

    // Master Gain
    if (!masterGainNode) {
      masterGainNode = ctx.createGain();
      masterGainNode.gain.value = parseFloat(volumeSlider.value);
    }

    // Analyser Node
    if (!analyserNode) {
      analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 2048;
      analyserNode.smoothingTimeConstant = 0.85;
    }

    // Tone Gain Node
    if (!toneGainNode) {
      toneGainNode = ctx.createGain();
      toneGainNode.gain.value = isToneEnabled ? currentToneVol : 0;
    }

    // Connect Master and Analyser to Destination
    masterGainNode.disconnect();
    masterGainNode.connect(analyserNode);
    analyserNode.connect(ctx.destination);
    toneGainNode.connect(masterGainNode);
  }

  function startAudio(seekTime = 0) {
    if (!audioBuffer) return;

    const ctx = getAudioContext();
    setupAudioNodes();

    // Stop existing source if any
    if (sourceNode) {
      try { sourceNode.stop(); } catch(e) {}
      sourceNode.disconnect();
    }

    sourceNode = ctx.createBufferSource();
    sourceNode.buffer = audioBuffer;

    // Apply Pitch Shifting
    const pitchRatio = targetReferenceFreq / 440;
    sourceNode.playbackRate.value = pitchRatio;

    sourceNode.connect(masterGainNode);

    // Track playback position
    pausedAt = seekTime;
    startTime = ctx.currentTime - pausedAt / pitchRatio;

    sourceNode.start(0, pausedAt);
    isPlaying = true;

    // Start Oscillator if enabled
    if (isToneEnabled) {
      startToneOscillator();
    }

    // Toggle icons
    iconPlay.classList.add('hidden');
    iconPause.classList.remove('hidden');

    sourceNode.onended = () => {
      // Check if playback reached the end naturally
      const elapsed = (ctx.currentTime - startTime) * pitchRatio;
      if (elapsed >= audioBuffer.duration) {
        stopAudio();
      }
    };

    startVisualizer();
    updateProgressLoop();
  }

  function pauseAudio() {
    if (!isPlaying || !sourceNode) return;

    const ctx = getAudioContext();
    const pitchRatio = targetReferenceFreq / 440;
    pausedAt = (ctx.currentTime - startTime) * pitchRatio;

    try { sourceNode.stop(); } catch(e) {}
    isPlaying = false;

    if (toneOscillator) {
      stopToneOscillator();
    }

    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
  }

  function stopAudio() {
    if (sourceNode) {
      try { sourceNode.stop(); } catch(e) {}
      sourceNode.disconnect();
      sourceNode = null;
    }

    if (toneOscillator) {
      stopToneOscillator();
    }

    isPlaying = false;
    pausedAt = 0;

    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
    progressBar.style.width = '0%';
    updateTimeDisplay();
  }

  btnPlayPause.addEventListener('click', () => {
    if (!audioBuffer) return;
    if (isPlaying) {
      pauseAudio();
    } else {
      startAudio(pausedAt);
    }
  });

  btnStop.addEventListener('click', stopAudio);

  volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (masterGainNode) {
      masterGainNode.gain.value = val;
    }
  });

  // Progress Bar Seeking
  progressContainer.addEventListener('click', (e) => {
    if (!audioBuffer) return;
    const rect = progressContainer.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = clickRatio * audioBuffer.duration;

    if (isPlaying) {
      startAudio(seekTime);
    } else {
      pausedAt = seekTime;
      progressBar.style.width = `${clickRatio * 100}%`;
      updateTimeDisplay();
    }
  });

  function updateTimeDisplay() {
    const totalSec = audioBuffer ? audioBuffer.duration : 0;
    const currentSec = Math.min(pausedAt, totalSec);

    trackTime.textContent = `${formatTime(currentSec)} / ${formatTime(totalSec)}`;
  }

  function updateProgressLoop() {
    if (!isPlaying || !audioBuffer) return;

    const ctx = getAudioContext();
    const pitchRatio = targetReferenceFreq / 440;
    const currentPos = (ctx.currentTime - startTime) * pitchRatio;
    pausedAt = Math.min(currentPos, audioBuffer.duration);

    const percent = (pausedAt / audioBuffer.duration) * 100;
    progressBar.style.width = `${Math.min(100, percent)}%`;
    updateTimeDisplay();

    if (isPlaying) {
      requestAnimationFrame(updateProgressLoop);
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // --- THERAPY TONE GENERATOR (SOLFEGGIO) ---
  function startToneOscillator() {
    stopToneOscillator();
    const ctx = getAudioContext();
    toneOscillator = ctx.createOscillator();
    toneOscillator.type = 'sine';
    toneOscillator.frequency.value = currentToneFreq;
    toneOscillator.connect(toneGainNode);
    toneOscillator.start();
  }

  function stopToneOscillator() {
    if (toneOscillator) {
      try { toneOscillator.stop(); } catch(e) {}
      toneOscillator.disconnect();
      toneOscillator = null;
    }
  }

  toneToggle.addEventListener('change', (e) => {
    isToneEnabled = e.target.checked;
    if (toneGainNode) {
      toneGainNode.gain.value = isToneEnabled ? currentToneVol : 0;
    }
    if (isPlaying) {
      if (isToneEnabled) {
        startToneOscillator();
      } else {
        stopToneOscillator();
      }
    }
  });

  solfeggioBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      solfeggioBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const freq = parseFloat(btn.dataset.freq);
      currentToneFreq = freq;
      customFreqInput.value = freq;

      if (toneOscillator) {
        toneOscillator.frequency.value = currentToneFreq;
      }
    });
  });

  btnApplyCustomFreq.addEventListener('click', () => {
    const val = parseFloat(customFreqInput.value);
    if (val >= 20 && val <= 20000) {
      currentToneFreq = val;
      solfeggioBtns.forEach(b => {
        b.classList.toggle('active', parseFloat(b.dataset.freq) === currentToneFreq);
      });
      if (toneOscillator) {
        toneOscillator.frequency.value = currentToneFreq;
      }
    }
  });

  toneVolSlider.addEventListener('input', (e) => {
    currentToneVol = parseFloat(e.target.value);
    toneVolDisplay.textContent = `${Math.round(currentToneVol * 100)}%`;
    if (toneGainNode && isToneEnabled) {
      toneGainNode.gain.value = currentToneVol;
    }
  });

  // --- PITCH SHIFTER CONTROLS ---
  function setPitchFrequency(freq) {
    targetReferenceFreq = freq;
    pitchValDisplay.textContent = `${freq} Hz`;
    pitchSlider.value = freq;

    pitchPresets.forEach(btn => {
      btn.classList.toggle('active', parseFloat(btn.dataset.pitch) === freq);
    });

    if (isPlaying && sourceNode) {
      const pitchRatio = targetReferenceFreq / 440;
      sourceNode.playbackRate.value = pitchRatio;
    }
  }

  pitchPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      setPitchFrequency(parseFloat(btn.dataset.pitch));
    });
  });

  pitchSlider.addEventListener('input', (e) => {
    setPitchFrequency(parseFloat(e.target.value));
  });

  // --- SPECTRUM VISUALIZER RENDERING ---
  chipButtons.forEach(chip => {
    chip.addEventListener('click', () => {
      chipButtons.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      visualizerMode = chip.dataset.mode;
    });
  });

  function startVisualizer() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    renderVisualizer();
  }

  function renderVisualizer() {
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    canvasCtx.clearRect(0, 0, width, height);

    if (analyserNode && isPlaying) {
      const bufferLength = analyserNode.frequencyBinCount;
      const freqData = new Uint8Array(bufferLength);
      const waveData = new Uint8Array(bufferLength);

      analyserNode.getByteFrequencyData(freqData);
      analyserNode.getByteTimeDomainData(waveData);

      if (visualizerMode === 'bars' || visualizerMode === 'dual') {
        drawFrequencyBars(freqData, bufferLength, width, height);
      }

      if (visualizerMode === 'wave' || visualizerMode === 'dual') {
        drawWaveform(waveData, bufferLength, width, height);
      }
    }

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(renderVisualizer);
    }
  }

  function drawFrequencyBars(data, length, width, height) {
    const barCount = 64; // Show 64 spectrum bars
    const barWidth = (width / barCount) - 2;
    let x = 0;

    for (let i = 0; i < barCount; i++) {
      // Map bar index non-linearly to focus on audible frequencies
      const dataIndex = Math.floor(Math.pow(i / barCount, 1.8) * (length * 0.5));
      const value = data[dataIndex] || 0;
      const barHeight = (value / 255) * (height * 0.85);

      const gradient = canvasCtx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, '#58a6ff');
      gradient.addColorStop(0.6, '#a371f7');
      gradient.addColorStop(1, '#f778ba');

      canvasCtx.fillStyle = gradient;
      canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);

      x += barWidth + 2;
    }
  }

  function drawWaveform(data, length, width, height) {
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#3fb950';
    canvasCtx.beginPath();

    const sliceWidth = width / length;
    let x = 0;

    for (let i = 0; i < length; i++) {
      const v = data[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(width, height / 2);
    canvasCtx.stroke();
  }

  // --- AUDIO EXPORT (OFFLINE AUDIO CONTEXT -> WAV) ---
  btnExportAudio.addEventListener('click', async () => {
    if (!audioBuffer) return;

    exportStatus.classList.remove('hidden');
    exportSpinner.classList.remove('hidden');
    exportStatusText.textContent = 'Renderizando áudio em alta qualidade...';
    btnExportAudio.disabled = true;

    try {
      const pitchRatio = targetReferenceFreq / 440;
      const duration = audioBuffer.duration / pitchRatio;
      const sampleRate = audioBuffer.sampleRate;
      const numberOfChannels = audioBuffer.numberOfChannels;

      const offlineCtx = new OfflineAudioContext(
        numberOfChannels,
        Math.ceil(duration * sampleRate),
        sampleRate
      );

      // 1. Audio Source Node with Pitch Shift
      const offlineSource = offlineCtx.createBufferSource();
      offlineSource.buffer = audioBuffer;
      offlineSource.playbackRate.value = pitchRatio;

      const offlineMasterGain = offlineCtx.createGain();
      offlineMasterGain.gain.value = 1.0; // Export at full volume scale

      offlineSource.connect(offlineMasterGain);

      // 2. Add Therapy Tone Overlay if Enabled
      if (isToneEnabled) {
        const offlineOsc = offlineCtx.createOscillator();
        offlineOsc.type = 'sine';
        offlineOsc.frequency.value = currentToneFreq;

        const offlineToneGain = offlineCtx.createGain();
        offlineToneGain.gain.value = currentToneVol;

        offlineOsc.connect(offlineToneGain);
        offlineToneGain.connect(offlineMasterGain);

        offlineOsc.start(0);
        offlineOsc.stop(duration);
      }

      offlineMasterGain.connect(offlineCtx.destination);
      offlineSource.start(0);

      // Render
      const renderedBuffer = await offlineCtx.startRendering();

      exportStatusText.textContent = 'Convertendo para WAV...';

      // Encode AudioBuffer to WAV format
      const wavBlob = audioBufferToWavBlob(renderedBuffer);

      // Trigger Download
      const downloadUrl = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const freqLabel = isToneEnabled ? `_${currentToneFreq}Hz` : '';
      const pitchLabel = targetReferenceFreq !== 440 ? `_${targetReferenceFreq}Hz-pitch` : '';
      a.download = `${currentFileName}${pitchLabel}${freqLabel}_terapia.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      exportStatusText.textContent = 'Download concluído!';
      exportSpinner.classList.add('hidden');

      setTimeout(() => {
        exportStatus.classList.add('hidden');
        btnExportAudio.disabled = false;
      }, 3000);

    } catch (err) {
      console.error('Erro ao exportar áudio:', err);
      exportStatusText.textContent = 'Erro ao exportar áudio.';
      exportSpinner.classList.add('hidden');
      btnExportAudio.disabled = false;
    }
  });

  // --- WAV ENCODER HELPER ---
  function audioBufferToWavBlob(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    let result;
    if (numChannels === 2) {
      result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
      result = buffer.getChannelData(0);
    }

    return createWavBlob(result, numChannels, sampleRate, format, bitDepth);
  }

  function interleave(inputL, inputR) {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    let index = 0;
    let inputIndex = 0;

    while (index < length) {
      result[index++] = inputL[inputIndex];
      result[index++] = inputR[inputIndex];
      inputIndex++;
    }
    return result;
  }

  function createWavBlob(samples, numChannels, sampleRate, format, bitDepth) {
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* RIFF chunk length */
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, format, true);
    /* channel count */
    view.setUint16(22, numChannels, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * blockAlign, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, blockAlign, true);
    /* bits per sample */
    view.setUint16(34, bitDepth, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * bytesPerSample, true);

    // Write PCM samples
    floatTo16BitPCM(view, 44, samples);

    return new Blob([buffer], { type: 'audio/wav' });
  }

  function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
});
