// test-streaming.js
console.log("Audio Streaming Test Client loaded");

// Global variables
let audioWebSocket = null;
let mediaRecorder = null;
let currentSessionId = null;
let currentStreamId = null;
let isRecording = false;
let isStreaming = false;
let streamStartTime = null;
let chunksSent = 0;
let bytesSent = 0;
let statsInterval = null;

// DOM elements
const elements = {
    sessionId: document.getElementById('sessionId'),
    wsStatus: document.getElementById('wsStatus'),
    streamId: document.getElementById('streamId'),
    recordingStatus: document.getElementById('recordingStatus'),
    currentStatus: document.getElementById('currentStatus'),
    logContainer: document.getElementById('logContainer'),
    chunksSent: document.getElementById('chunksSent'),
    bytesSent: document.getElementById('bytesSent'),
    streamDuration: document.getElementById('streamDuration'),
    dataRate: document.getElementById('dataRate'),
    
    connectBtn: document.getElementById('connectBtn'),
    disconnectBtn: document.getElementById('disconnectBtn'),
    recordBtn: document.getElementById('recordBtn'),
    stopBtn: document.getElementById('stopBtn'),
    streamInfoBtn: document.getElementById('streamInfoBtn'),
    clearLogBtn: document.getElementById('clearLogBtn')
};

// Initialize session
function initializeSession() {
    currentSessionId = 'test-session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    elements.sessionId.textContent = currentSessionId;
    updateStatus("Session initialized. Click 'Connect WebSocket' to begin.");
    logMessage('info', 'Session initialized: ' + currentSessionId);
}

// Update status display
function updateStatus(message, type = 'info') {
    elements.currentStatus.textContent = message;
    elements.currentStatus.style.borderLeftColor = getStatusColor(type);
    logMessage(type, message);
}

function getStatusColor(type) {
    const colors = {
        'info': '#2196f3',
        'success': '#4caf50',
        'error': '#f44336',
        'warning': '#ff9800'
    };
    return colors[type] || '#2196f3';
}

// Logging functions
function logMessage(type, message) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `
        <span class="log-timestamp">[${timestamp}]</span>
        <span class="log-message">${message}</span>
    `;
    
    elements.logContainer.appendChild(logEntry);
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
    
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function clearLog() {
    elements.logContainer.innerHTML = '';
    logMessage('info', 'Log cleared');
}

// WebSocket functions
function connectWebSocket() {
    if (audioWebSocket && audioWebSocket.readyState === WebSocket.OPEN) {
        logMessage('warning', 'WebSocket already connected');
        return;
    }
    
    const wsUrl = `ws://localhost:8000/ws/audio/${currentSessionId}`;
    logMessage('info', `Connecting to WebSocket: ${wsUrl}`);
    
    elements.wsStatus.textContent = 'Connecting...';
    elements.wsStatus.className = 'status-connecting';
    updateStatus("Connecting to WebSocket server...", 'info');
    
    audioWebSocket = new WebSocket(wsUrl);
    
    audioWebSocket.onopen = function(event) {
        logMessage('success', 'WebSocket connected successfully');
        elements.wsStatus.textContent = 'Connected';
        elements.wsStatus.className = 'status-connected';
        updateStatus("WebSocket connected. Ready to stream audio.", 'success');
        
        // Enable/disable buttons
        elements.connectBtn.disabled = true;
        elements.disconnectBtn.disabled = false;
        elements.recordBtn.disabled = false;
        elements.streamInfoBtn.disabled = false;
    };
    
    audioWebSocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            logMessage('info', `WebSocket message: ${event.data}`);
        }
    };
    
    audioWebSocket.onclose = function(event) {
        logMessage('warning', `WebSocket connection closed (code: ${event.code})`);
        elements.wsStatus.textContent = 'Disconnected';
        elements.wsStatus.className = 'status-disconnected';
        updateStatus("WebSocket disconnected", 'warning');
        
        // Reset state
        audioWebSocket = null;
        isStreaming = false;
        currentStreamId = null;
        elements.streamId.textContent = 'None';
        
        // Enable/disable buttons
        elements.connectBtn.disabled = false;
        elements.disconnectBtn.disabled = true;
        elements.recordBtn.disabled = true;
        elements.stopBtn.disabled = true;
        elements.streamInfoBtn.disabled = true;
        
        if (isRecording) {
            stopRecording();
        }
    };
    
    audioWebSocket.onerror = function(error) {
        logMessage('error', `WebSocket error: ${error.message || 'Connection failed'}`);
        updateStatus("WebSocket connection error", 'error');
    };
}

function disconnectWebSocket() {
    if (audioWebSocket) {
        if (isRecording) {
            stopRecording();
        }
        
        logMessage('info', 'Disconnecting WebSocket');
        audioWebSocket.close();
    }
}

function handleWebSocketMessage(data) {
    logMessage('info', `WebSocket message: ${data.type}`);
    
    switch(data.type) {
        case 'audio_welcome':
            logMessage('success', data.message);
            break;
            
        case 'stream_started':
            currentStreamId = data.stream_id;
            isStreaming = true;
            streamStartTime = Date.now();
            elements.streamId.textContent = currentStreamId;
            logMessage('success', `Audio streaming started: ${currentStreamId}`);
            updateStatus("Audio streaming active. Recording will be saved to server.", 'success');
            
            // Start statistics updates
            startStatsUpdates();
            break;
            
        case 'stream_stopped':
            const result = data.result;
            isStreaming = false;
            currentStreamId = null;
            streamStartTime = null;
            elements.streamId.textContent = 'None';
            
            logMessage('success', `Stream stopped: ${result.filename}`);
            logMessage('data', `Stats: ${result.chunks_received} chunks, ${result.total_bytes} bytes`);
            updateStatus(`Stream saved to: ${result.filename}`, 'success');
            
            // Stop statistics updates
            stopStatsUpdates();
            break;
            
        case 'error':
            logMessage('error', `Server error: ${data.message}`);
            updateStatus(`Error: ${data.message}`, 'error');
            break;
            
        case 'stream_info':
            if (data.stream_info) {
                const info = data.stream_info;
                logMessage('data', `Stream info: ${info.chunks_received} chunks, ${info.total_bytes} bytes`);
            } else {
                logMessage('info', data.message || 'No active stream');
            }
            break;
            
        default:
            logMessage('info', `Unknown message type: ${data.type}`);
    }
}

// Audio recording functions
async function startRecording() {
    if (isRecording) {
        logMessage('warning', 'Already recording');
        return;
    }
    
    if (!audioWebSocket || audioWebSocket.readyState !== WebSocket.OPEN) {
        logMessage('error', 'WebSocket not connected');
        updateStatus("Cannot start recording: WebSocket not connected", 'error');
        return;
    }
    
    try {
        logMessage('info', 'Requesting microphone access...');
        
        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        
        logMessage('success', 'Microphone access granted');
        
        // Check for supported MIME types
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/webm';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/mp4';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = '';
                }
            }
        }
        
        logMessage('info', `Using MIME type: ${mimeType || 'default'}`);
        
        // Create MediaRecorder
        mediaRecorder = new MediaRecorder(stream, mimeType ? { 
            mimeType: mimeType,
            audioBitsPerSecond: 128000 
        } : {});
        
        // Reset statistics
        chunksSent = 0;
        bytesSent = 0;
        updateStatsDisplay();
        
        // Handle data available
        mediaRecorder.ondataavailable = function(event) {
            if (event.data.size > 0 && audioWebSocket && audioWebSocket.readyState === WebSocket.OPEN && isStreaming) {
                // Convert Blob to ArrayBuffer and send
                event.data.arrayBuffer().then(buffer => {
                    audioWebSocket.send(buffer);
                    
                    // Update statistics
                    chunksSent++;
                    bytesSent += buffer.byteLength;
                    updateStatsDisplay();
                    
                    logMessage('data', `Sent chunk ${chunksSent}: ${buffer.byteLength} bytes`);
                }).catch(error => {
                    logMessage('error', `Error sending audio chunk: ${error.message}`);
                });
            }
        };
        
        mediaRecorder.onstop = function() {
            logMessage('info', 'MediaRecorder stopped');
            stream.getTracks().forEach(track => track.stop());
            
            // Stop server-side stream if still active
            if (isStreaming && audioWebSocket && audioWebSocket.readyState === WebSocket.OPEN) {
                const stopCommand = { type: "stop_stream" };
                audioWebSocket.send(JSON.stringify(stopCommand));
                logMessage('info', 'Sent stop_stream command to server');
            }
        };
        
        // Start recording
        mediaRecorder.start(100); // Send data every 100ms
        isRecording = true;
        
        // Start server-side streaming
        const startCommand = { type: "start_stream" };
        audioWebSocket.send(JSON.stringify(startCommand));
        logMessage('info', 'Sent start_stream command to server');
        
        // Update UI
        elements.recordBtn.textContent = '🔴 Recording...';
        elements.recordBtn.classList.add('recording');
        elements.recordBtn.disabled = true;
        elements.stopBtn.disabled = false;
        elements.recordingStatus.textContent = 'Recording';
        elements.recordingStatus.style.color = '#f44336';
        
        updateStatus("Recording started. Audio chunks are being streamed to server.", 'success');
        
    } catch (error) {
        logMessage('error', `Failed to start recording: ${error.message}`);
        updateStatus(`Recording failed: ${error.message}`, 'error');
    }
}

function stopRecording() {
    if (!isRecording) {
        logMessage('warning', 'Not currently recording');
        return;
    }
    
    logMessage('info', 'Stopping recording...');
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    
    isRecording = false;
    
    // Update UI
    elements.recordBtn.textContent = '🎙️ Start Recording';
    elements.recordBtn.classList.remove('recording');
    elements.recordBtn.disabled = false;
    elements.stopBtn.disabled = true;
    elements.recordingStatus.textContent = 'Stopped';
    elements.recordingStatus.style.color = '#fff';
    
    updateStatus("Recording stopped. Processing final chunks...", 'info');
}

function getStreamInfo() {
    if (audioWebSocket && audioWebSocket.readyState === WebSocket.OPEN) {
        const infoCommand = { type: "stream_info" };
        audioWebSocket.send(JSON.stringify(infoCommand));
        logMessage('info', 'Requested stream info from server');
    } else {
        logMessage('warning', 'WebSocket not connected');
    }
}

// Statistics functions
function startStatsUpdates() {
    if (statsInterval) {
        clearInterval(statsInterval);
    }
    
    statsInterval = setInterval(updateStatsDisplay, 500);
}

function stopStatsUpdates() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
}

function updateStatsDisplay() {
    elements.chunksSent.textContent = chunksSent;
    elements.bytesSent.textContent = formatBytes(bytesSent);
    
    if (streamStartTime) {
        const duration = (Date.now() - streamStartTime) / 1000;
        elements.streamDuration.textContent = formatDuration(duration);
        
        const rate = duration > 0 ? (bytesSent / duration / 1024) : 0;
        elements.dataRate.textContent = rate.toFixed(1) + ' KB/s';
    } else {
        elements.streamDuration.textContent = '0s';
        elements.dataRate.textContent = '0 KB/s';
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
    if (seconds < 60) {
        return seconds.toFixed(1) + 's';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
}

// Event listeners
elements.connectBtn.addEventListener('click', connectWebSocket);
elements.disconnectBtn.addEventListener('click', disconnectWebSocket);
elements.recordBtn.addEventListener('click', startRecording);
elements.stopBtn.addEventListener('click', stopRecording);
elements.streamInfoBtn.addEventListener('click', getStreamInfo);
elements.clearLogBtn.addEventListener('click', clearLog);

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    logMessage('info', 'Audio Streaming Test Client initialized');
    initializeSession();
});

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    if (isRecording) {
        stopRecording();
    }
    if (audioWebSocket) {
        disconnectWebSocket();
    }
});

// Export utilities for debugging
window.streamingTestUtils = {
    getState: function() {
        return {
            sessionId: currentSessionId,
            streamId: currentStreamId,
            isRecording: isRecording,
            isStreaming: isStreaming,
            wsState: audioWebSocket ? audioWebSocket.readyState : 'closed',
            chunksSent: chunksSent,
            bytesSent: bytesSent
        };
    },
    
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
    startRecord: startRecording,
    stopRecord: stopRecording,
    getInfo: getStreamInfo,
    clearLog: clearLog
};

console.log("💡 Available debug utilities:");
console.log("- streamingTestUtils.getState() - Get current state");
console.log("- streamingTestUtils.connect() - Connect WebSocket");
console.log("- streamingTestUtils.startRecord() - Start recording");
console.log("- streamingTestUtils.stopRecord() - Stop recording");