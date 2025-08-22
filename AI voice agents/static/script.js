let ws = null;
let isRecording = false;
let audioBuffer = [];
let audioContext = null;
let processor = null;
let source = null;
let stream = null;

// Calculate proper buffer size for 200ms chunks at 16kHz
const SAMPLE_RATE = 16000;
const CHUNK_DURATION_MS = 100; // 200ms chunks (well within 50-1000ms requirement)
const SAMPLES_PER_CHUNK = (SAMPLE_RATE * CHUNK_DURATION_MS) / 1000;
const BYTES_PER_CHUNK = SAMPLES_PER_CHUNK * 2; // 2 bytes per 16-bit sample

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const messages = document.getElementById('messages');

startBtn.onclick = startRecording;
stopBtn.onclick = stopRecording;

function sendAudioChunk() {
    if (audioBuffer.length === 0 || !ws || ws.readyState !== WebSocket.OPEN) return;

    // Calculate total samples needed for our target duration
    const totalSamples = audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    
    if (totalSamples < SAMPLES_PER_CHUNK) return; // Wait for more data

    // Take exactly the amount we need for our chunk duration
    const chunkBuffer = new Int16Array(SAMPLES_PER_CHUNK);
    let samplesUsed = 0;
    let bufferIndex = 0;

    while (samplesUsed < SAMPLES_PER_CHUNK && bufferIndex < audioBuffer.length) {
        const currentChunk = audioBuffer[bufferIndex];
        const samplesNeeded = SAMPLES_PER_CHUNK - samplesUsed;
        const samplesToTake = Math.min(samplesNeeded, currentChunk.length);

        chunkBuffer.set(currentChunk.subarray(0, samplesToTake), samplesUsed);
        samplesUsed += samplesToTake;

        if (samplesToTake < currentChunk.length) {
            // Keep the remaining part of this chunk
            audioBuffer[bufferIndex] = currentChunk.subarray(samplesToTake);
        } else {
            // Remove this chunk entirely
            bufferIndex++;
        }
    }

    // Remove used buffers
    audioBuffer = audioBuffer.slice(bufferIndex);

    // Send the properly sized chunk
    console.log(`Sending audio chunk: ${chunkBuffer.length} samples (${CHUNK_DURATION_MS}ms)`);

    // Safety check for chunk size (max 800ms to be safe)
    const maxSamples = (SAMPLE_RATE * 800) / 1000;
    if (chunkBuffer.length > maxSamples) {
        console.log("Chunk too large, skipping");
        return;
    }

    ws.send(chunkBuffer.buffer);
}

async function startRecording() {
    try {
        // Reset buffers
        audioBuffer = [];
        
        ws = new WebSocket('ws://127.0.0.1:8000/ws');
        
        ws.onopen = () => {
            status.textContent = 'Connected';
            status.className = 'status connected';
            ws.send(JSON.stringify({type: 'start'}));
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleMessage(data);
        };
        
        ws.onclose = () => {
            status.textContent = 'Disconnected';
            status.className = 'status disconnected';
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            status.textContent = 'Connection Error';
            status.className = 'status disconnected';
        };

        stream = await navigator.mediaDevices.getUserMedia({
            audio: { 
                sampleRate: SAMPLE_RATE,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: SAMPLE_RATE
        });

        // Use a smaller buffer size for more frequent processing
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        source = audioContext.createMediaStreamSource(stream);

        processor.onaudioprocess = (event) => {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            
            const inputData = event.inputBuffer.getChannelData(0);
            const int16Data = new Int16Array(inputData.length);
    
            // Convert float32 to int16
            for (let i = 0; i < inputData.length; i++) {
                const sample = Math.max(-1, Math.min(1, inputData[i]));
                int16Data[i] = sample * 0x7FFF;
            }
    
            // Add to buffer
            audioBuffer.push(int16Data);
    
            // Send chunk when we have enough data
            sendAudioChunk();
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        
        isRecording = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        startBtn.textContent = '🎙️ Recording...';
        
        console.log(`Started recording with ${CHUNK_DURATION_MS}ms chunks`);
        
    } catch (error) {
        console.error('Error starting recording:', error);
        alert('Microphone access denied or not available');
        resetUI();
    }
}

function stopRecording() {
    console.log('Stopping recording...');
    
    // Send any remaining audio data
    audioBuffer = [];
    
    // Clean up audio context
    if (processor) {
        processor.disconnect();
        processor = null;
    }
    if (source) {
        source.disconnect();
        source = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    // Stop media stream
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Close WebSocket
    if (ws) {
        ws.close();
        ws = null;
    }
    
    audioBuffer = [];
    resetUI();
}

function resetUI() {
    isRecording = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    startBtn.textContent = 'Start Recording';
    status.textContent = 'Ready';
    status.className = 'status';
}

function handleMessage(data) {
    const timestamp = new Date().toLocaleTimeString();
    
    if (data.type === 'turn_end') {
        addMessage(`👤 You: ${data.text}`, timestamp);
    } else if (data.type === 'llm_response') {
        addMessage(`🤖 AI: ${data.text}`, timestamp, 'llm-response');
    }
}

function addMessage(text, timestamp, className = '') {
    const div = document.createElement('div');
    div.className = `turn ${className}`;
    div.innerHTML = `
        <div class="timestamp">${timestamp}</div>
        <div>${text}</div>
    `;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

window.addEventListener('beforeunload', stopRecording);