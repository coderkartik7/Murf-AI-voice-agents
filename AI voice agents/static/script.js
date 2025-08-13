console.log("Modern AI Conversational Agent loaded");

// Variables
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let currentSessionId = null;
let isWaitingForResponse = false;
let conversationActive = false;

// Get DOM elements
const recordBtn = document.getElementById('recordBtn');
const stopConversationBtn = document.getElementById('stopConversationBtn');
const chatArea = document.getElementById('chatArea');
const statusMessage = document.getElementById('statusMessage');
const currentSessionIdDisplay = document.getElementById('currentSessionId');
const newSessionBtn = document.getElementById('newSessionBtn');
const userNameInput = document.getElementById('userNameInput');
const audioPlayback = document.getElementById('audioPlayback');

// Session Management
function generateSessionId() {
    return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function getSessionIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('session_id');
}

function setSessionIdInURL(sessionId) {
    const url = new URL(window.location);
    url.searchParams.set('session_id', sessionId);
    window.history.replaceState({}, '', url);
}

function initializeSession() {
    let sessionId = getSessionIdFromURL();
    
    if (!sessionId) {
        sessionId = generateSessionId();
        setSessionIdInURL(sessionId);
    }
    
    currentSessionId = sessionId;
    
    if (currentSessionIdDisplay) {
        currentSessionIdDisplay.textContent = sessionId;
    }
    
    // Load existing chat history
    loadChatHistory(sessionId);
    
    console.log("Session initialized:", sessionId);
}

async function loadChatHistory(sessionId) {
    try {
        const response = await fetch(`/agent/chat/${sessionId}/history`);
        const data = await response.json();
        
        if (data.success && data.chat_history) {
            // Clear current chat display (except status)
            const statusEl = document.getElementById('statusMessage');
            chatArea.innerHTML = '';
            chatArea.appendChild(statusEl);
            
            // Display chat history
            data.chat_history.forEach(message => {
                addChatMessage(message.role === 'user' ? 'user' : 'ai', message.content, false);
            });
            
            console.log(`Loaded ${data.chat_history.length} messages for session ${sessionId}`);
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

async function createNewSession() {
    const newSessionId = generateSessionId();
    currentSessionId = newSessionId;
    setSessionIdInURL(newSessionId);
    
    if (currentSessionIdDisplay) {
        currentSessionIdDisplay.textContent = newSessionId;
    }
    
    // Clear chat area and reset status
    const statusEl = document.getElementById('statusMessage');
    chatArea.innerHTML = '';
    chatArea.appendChild(statusEl);
    
    updateStatus("New session created! Ready to chat.", "ready");
    
    // Reset conversation state
    conversationActive = false;
    stopConversationBtn.disabled = true;
    
    console.log("New session created:", newSessionId);
}

// UI Update Functions
function updateStatus(message, type = "ready") {
    if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
    }
}

function addChatMessage(type, text, animate = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}-message`;
    if (animate) messageDiv.style.opacity = '0';
    
    const userName = userNameInput.value || 'User';
    const displayName = type === 'user' ? userName : 'AI Assistant';
    
    messageDiv.innerHTML = `<strong>${displayName}:</strong> ${text}`;
    
    chatArea.appendChild(messageDiv);
    
    // Animate in
    if (animate) {
        setTimeout(() => {
            messageDiv.style.opacity = '1';
        }, 100);
    }
    
    // Scroll to bottom
    chatArea.scrollTop = chatArea.scrollHeight;
}

function showThinkingDots() {
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'thinking-dots';
    thinkingDiv.id = 'thinkingDots';
    thinkingDiv.innerHTML = '<span></span><span></span><span></span>';
    chatArea.appendChild(thinkingDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
}

function hideThinkingDots() {
    const thinkingDots = document.getElementById('thinkingDots');
    if (thinkingDots) {
        thinkingDots.remove();
    }
}

// Recording Functions
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            } 
        });

        // Check for supported MIME types
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/webm';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/mp4';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = ''; // Use default
                    }
            }
        }

        mediaRecorder = new MediaRecorder(stream, mimeType ? { 
            mimeType: mimeType,
            audioBitsPerSecond: 128000 
        } : {});

        console.log("Using MIME type:", mimeType || "default");

        audioChunks = [];
        isRecording = true;
        conversationActive = true;
        stopConversationBtn.disabled = false;

        mediaRecorder.ondataavailable = (event) => {
        console.log("Audio data received:", event.data.size, "bytes");
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
            console.log("Audio blob created:", audioBlob.size, "bytes");
    
            if (audioBlob.size < 1000) {  // Less than 1KB likely means no audio
                updateStatus('⚠️ Recording too short. Please speak for longer.', 'error');
                isWaitingForResponse = false;
                return;
            }
    
            await processAudio(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorder.start(100);

        // Update UI
        recordBtn.classList.add('recording');
        recordBtn.innerHTML = '⏹️';
        updateStatus('🎙️ Recording your message... Speak clearly!', 'recording');

    } catch (error) {
        console.error('Error accessing microphone:', error);
        updateStatus(`Error: ${error.message}`, 'error');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        isWaitingForResponse = true;

        // Update UI
        recordBtn.classList.remove('recording');
        recordBtn.innerHTML = '🎙️';
        updateStatus('Processing your message...', 'processing');
        showThinkingDots();
    }
}

function stopConversation() {
    conversationActive = false;
    stopConversationBtn.disabled = true;
    
    if (isRecording) {
        stopRecording();
    }
    
    updateStatus('Conversation stopped. Click microphone to start again.', 'ready');
    console.log('Conversation stopped by user');
}

// Process audio with backend
async function processAudio(audioBlob) {
    try {
        if (!currentSessionId) {
            throw new Error('No active session');
        }
        
        const formData = new FormData();
        formData.append('audio_file', audioBlob, 'chat_query.webm');
        formData.append('model', 'gemini-2.0-flash-exp');
        
        updateStatus('🤔 AI is thinking...', 'processing');
        
        console.log(`Calling /agent/chat/${currentSessionId} endpoint...`);
        const response = await fetch(`/agent/chat/${currentSessionId}`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        console.log("Chat agent response:", data);
        
        if (!response.ok) {
            const serverError = data.detail || `HTTP error! status: ${response.status}`;
            throw new Error(serverError);
        }
        
        if (data.success) {
            hideThinkingDots();
            
            // Add messages to chat display
            addChatMessage('user', data.transcribed_text);
            addChatMessage('ai', data.llm_response);
            
            updateStatus('✅ Response ready! Listen below 👇', 'ready');
            
            // Set up audio playback
            if (audioPlayback && data.audio_url) {
                audioPlayback.src = data.audio_url;
                audioPlayback.style.display = 'block';
                
                // Auto-play the response
                setTimeout(() => {
                    audioPlayback.play().catch(e => {
                        console.log("Auto-play prevented by browser");
                    });
                }, 500);
            }
            
            isWaitingForResponse = false;
            
        } else {
            console.error("Chat agent failed:", data.error);
            throw new Error(data.error || 'Chat processing failed');
        }
        
    } catch (error) {
        handleError(error);
    }
}

function handleError(error) {
    console.error('Error:', error);
    hideThinkingDots();
    
    let errorMessage = 'Something went wrong. Please try again.';
    
    if (error.message.includes('No speech detected')) {
        errorMessage = '🎤 No speech detected. Please speak clearly and try again.';
    } else if (error.message.includes('Transcription failed')) {
        errorMessage = '🎤 Could not understand your speech. Please try again.';
    } else if (error.message.includes('401')) {
        errorMessage = 'API key error. Please check configuration.';
    } else if (error.message.includes('429')) {
        errorMessage = 'Rate limit exceeded. Please wait and try again.';
    } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later.';
    }
    
    updateStatus(`❌ ${errorMessage}`, 'error');
    isWaitingForResponse = false;
}

// Event Listeners
recordBtn.addEventListener('click', () => {
    if (!isRecording && !isWaitingForResponse) {
        startRecording();
    } else if (isRecording) {
        stopRecording();
    }
});

stopConversationBtn.addEventListener('click', stopConversation);
newSessionBtn.addEventListener('click', createNewSession);

// Auto-recording after AI response
audioPlayback.addEventListener('ended', () => {
    console.log("AI audio finished playing");
    if (conversationActive && !isRecording && !isWaitingForResponse) {
        setTimeout(() => {
            if (conversationActive) {
                console.log("Auto-starting recording after AI response");
                startRecording();
            }
        }, 1000);
    }
});

// Save user name to localStorage
userNameInput.addEventListener('change', () => {
    localStorage.setItem('userName', userNameInput.value);
});

// Load saved user name
const savedName = localStorage.getItem('userName');
if (savedName) {
    userNameInput.value = savedName;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log("Initializing Modern AI Conversational Agent...");
    initializeSession();
    console.log("Agent initialized successfully!");
});

// Utility functions for debugging
window.voiceAgentUtils = {
    getCurrentSession: function() {
        return {
            sessionId: currentSessionId,
            isRecording: isRecording,
            isWaiting: isWaitingForResponse,
            conversationActive: conversationActive
        };
    },
    
    createNewSession: createNewSession,
    stopConversation: stopConversation
};

console.log("💡 Try: voiceAgentUtils.getCurrentSession() to check current session");