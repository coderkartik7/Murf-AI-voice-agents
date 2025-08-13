console.log("Enhanced AI Chat Agent with Session Management loaded");

// Variables
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let chatMediaRecorder;
let chatAudioChunks = [];
let chatIsRecording = false;
let currentSessionId = null;
let autoRecordingEnabled = false;
let isWaitingForResponse = false;

// Get DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const audioPlayback = document.getElementById('audioPlayback');
const llmStartBtn = document.getElementById('llmStartBtn');
const llmStopBtn = document.getElementById('llmStopBtn');
const llmStatus = document.getElementById('llmStatus');
const llmAudioPlayback = document.getElementById('llmAudioPlayback');
const chatContainer = document.getElementById('chatContainer');
const currentSessionIdDisplay = document.getElementById('currentSessionId');
const newSessionBtn = document.getElementById('newSessionBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const disableThinkingCheckbox = document.getElementById('disableThinking');
const thinkingDots = document.getElementById('thinkingDots');

// Log element status
console.log("Echo Bot elements:", {
    startBtn: !!startBtn,
    stopBtn: !!stopBtn,
    status: !!status,
    audioPlayback: !!audioPlayback,
    llmStartBtn: !!llmStartBtn,
    llmStopBtn: !!llmStopBtn,
    llmStatus: !!llmStatus,
    llmAudioPlayback: !!llmAudioPlayback,
    chatContainer: !!chatContainer,
    currentSessionIdDisplay: !!currentSessionIdDisplay,
    newSessionBtn: !!newSessionBtn,
    clearChatBtn: !!clearChatBtn,
    disableThinkingCheckbox: !!disableThinkingCheckbox,
    thinkingDots: !!thinkingDots
});

// Initialize Echo Bot
function initEchoBot() {
    console.log("Initializing Echo Bot v2");
    
    // Set initial state
    if (stopBtn) stopBtn.disabled = true;
    if(status) {
        status.textContent = "Ready to Record ";
        status.className = "status ready"
    }
    
    // Add event listeners
    if (startBtn) {
        startBtn.addEventListener('click', startRecording);
        console.log("Added click event to Start button");
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', stopRecording);
        console.log("Added click event to Stop button");
    }
}

// Start recording function
async function startRecording() {
    console.log("Start recording called");
    
    try {
        console.log("Requesting microphone access...");
        
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation : true,
                noiseSuppression : true,
                sampleRate : 44100
            } 
        });
        console.log("Microphone access granted");

        // Initialize MediaRecorder
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000
        });
        console.log("MediaRecorder created");

        // Reset audio chunks
        audioChunks = [];
        isRecording = true;

        // Set up event listeners
        mediaRecorder.ondataavailable = (event) => {
            console.log("Data available event:", event.data.size);
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async() => {
            console.log("Recording stopped");
            // Create blob from chunks
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            console.log("Audio blob created:", audioBlob.size, "bytes");

            await processEchoAudio(audioBlob);

            stream.getTracks().forEach(track => track.stop());
            console.log("Microphone released");
            
        };

        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms
        console.log("MediaRecorder started");
        isRecording = true;

        // Update UI
        if (startBtn) {
            startBtn.disabled = true;
            console.log("Start button disabled");
        }
        if (stopBtn) {
            stopBtn.disabled = false;
            console.log("Stop button enabled");
        }
        if (status) {
            status.textContent = 'Recording... Speak into your microphone!';
            status.className = 'status recording';
            console.log("Status updated to 'recording'");
        }
        if (audioPlayback) {
            audioPlayback.style.display = 'none';
            console.log("Audio playback hidden");
        }

    } catch (error) {
        console.error('Error accessing microphone:', error);
        if (status) {
            status.textContent = `Error: ${error.message}`;
            status.className = 'status error';
            console.log("Error status displayed");
        }
    }
}

// Stop recording function
function stopRecording() {
    console.log("Stop recording called");
    
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        console.log("MediaRecorder stopped");

        // Update UI
        if (startBtn) {
            startBtn.disabled = false;
            console.log("Start button enabled");
        }
        if (stopBtn) {
            stopBtn.disabled = true;
            console.log("Stop button disabled");
        }
        if (status) {
            status.textContent = 'Processing your voice...Transcribing & Generating AI voice';
            status.className = 'status processing';
            console.log("Status updated to processing");
        }
    }
}

// Session Management Functions
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
            // Clear current chat display
            if (chatContainer) {
                chatContainer.innerHTML = '';
            }
            
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
    
    if (chatContainer) {
        chatContainer.innerHTML = '';
    }
    
    if (llmStatus) {
        llmStatus.textContent = "New session created! Ready to chat - Click 'Start Recording' to ask me anything!";
        llmStatus.className = 'status ready';
    }
    
    console.log("New session created:", newSessionId);
}

async function clearCurrentChatHistory() {
    if (!currentSessionId) return;
    
    try {
        const response = await fetch(`/agent/chat/${currentSessionId}/history`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (chatContainer) {
                chatContainer.innerHTML = '';
            }
            
            if (llmStatus) {
                llmStatus.textContent = "Chat history cleared! Ready to start fresh.";
                llmStatus.className = 'status ready';
            }
            
            console.log("Chat history cleared for session:", currentSessionId);
        }
    } catch (error) {
        console.error('Error clearing chat history:', error);
    }
}

// Initialize Chat Agent
function initChatAgent() {
    console.log("Initializing Enhanced Chat Agent");
    
    // Initialize session
    initializeSession();
    
    // Set initial state
    if (llmStopBtn) llmStopBtn.disabled = true;
    if (llmStatus) {
        llmStatus.textContent = "Ready to chat - Click 'Start Recording' to ask me anything!";
        llmStatus.className = "status ready";
    }
    
    // Add event listeners
    if (llmStartBtn) {
        llmStartBtn.addEventListener('click', startChatRecording);
    }
    
    if (llmStopBtn) {
        llmStopBtn.addEventListener('click', stopChatRecording);
    }
    
    if (newSessionBtn) {
        newSessionBtn.addEventListener('click', createNewSession);
    }
    
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearCurrentChatHistory);
    }
    
    // Audio playback event listener for auto-recording
    if (llmAudioPlayback) {
        llmAudioPlayback.addEventListener('ended', () => {
            console.log("AI audio finished playing");
            // Auto-start recording after AI response finishes
            setTimeout(() => {
                if (!chatIsRecording && !isWaitingForResponse) {
                    console.log("Auto-starting recording after AI response");
                    showAutoRecordingIndicator();
                    startChatRecording();
                }
            }, 1000); // 1 second delay before auto-recording
        });
    }
}

function showAutoRecordingIndicator() {
    // Create or show auto-recording indicator
    let indicator = document.getElementById('autoRecordingIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'autoRecordingIndicator';
        indicator.className = 'auto-recording-indicator';
        indicator.innerHTML = '🎙️ Auto-recording started...';
        document.body.appendChild(indicator);
    }
    
    indicator.classList.add('active');
    
    // Hide after 3 seconds
    setTimeout(() => {
        indicator.classList.remove('active');
    }, 3000);
}

// Chat Agent start recording function
async function startChatRecording() {
    console.log("Chat recording started");
    
    try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            } 
        });

        // Initialize MediaRecorder
        chatMediaRecorder = new MediaRecorder(stream,{
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000
        });

        // Reset audio chunks
        chatAudioChunks = [];
        chatIsRecording = true;
        isWaitingForResponse = false;

        // Set up event listeners
        chatMediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chatAudioChunks.push(event.data);
            }
        };

        chatMediaRecorder.onstop = async () => {
            console.log("Chat recording stopped");
            const audioBlob = new Blob(chatAudioChunks, { type: 'audio/webm' });
            await processChatAudio(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };

        // Start recording
        chatMediaRecorder.start(100);
        chatIsRecording = true;

        // Update UI
        if (llmStartBtn) llmStartBtn.disabled = true;
        if (llmStopBtn) llmStopBtn.disabled = false;
        if (llmStatus) {
            llmStatus.textContent = '🎙️ Recording your message... Speak clearly!';
            llmStatus.className = 'status recording';
        }
        if (llmAudioPlayback) llmAudioPlayback.style.display = 'none';

    } catch (error) {
        console.error('Error accessing microphone for chat:', error);
        if (llmStatus) {
            llmStatus.textContent = `Error: ${error.message}`;
            llmStatus.className = 'status error';
        }
    }
}

// Chat Agent stop recording function
function stopChatRecording() {
    console.log("Chat recording stop called");
    
    if (chatMediaRecorder && chatIsRecording) {
        chatMediaRecorder.stop();
        chatIsRecording = false;
        isWaitingForResponse = true;

        // Update UI
        if (llmStartBtn) llmStartBtn.disabled = false;
        if (llmStopBtn) llmStopBtn.disabled = true;
        if (llmStatus) {
            llmStatus.textContent = 'Processing your message...';
            llmStatus.className = 'status processing';
        }
        
        // Show thinking dots
        if (thinkingDots) {
            thinkingDots.style.display = 'flex';
        }
    }
}

// Process chat audio with the new /agent/chat/{session_id} endpoint
async function processChatAudio(audioBlob) {
    try {
        if (!currentSessionId) {
            throw new Error('No active session');
        }
        
        // Get disable thinking preference
        const disableThinking = disableThinkingCheckbox ? disableThinkingCheckbox.checked : false;
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('audio_file', audioBlob, 'chat_query.webm');
        formData.append('model', 'gemini-2.0-flash-exp');
        formData.append('disable_thinking', disableThinking);
        
        // Update status
        if (llmStatus) {
            llmStatus.textContent = disableThinking ? '⚡ Fast processing...' : '🤔 AI is thinking...';
            llmStatus.className = 'status processing';
        }
        
        // Call the chat agent endpoint
        console.log(`Calling /agent/chat/${currentSessionId} endpoint...`);
        const response = await fetch(`/agent/chat/${currentSessionId}`, {
            method: 'POST',
            body: formData
        });
        
        // Parse response even for error status codes
        const data = await response.json();
        console.log("Chat agent response:", data);
        
        if (!response.ok) {
            // Use the server's error message if available
            const serverError = data.detail || `HTTP error! status: ${response.status}`;
            throw new Error(serverError);
        }
        
        if (data.success) {
            // Hide thinking dots
            if (thinkingDots) {
                thinkingDots.style.display = 'none';
            }
            
            // Add messages to chat display (they're already in history from server)
            addChatMessage('user', data.transcribed_text);
            addChatMessage('ai', data.llm_response);
            
            // Update status
            if (llmStatus) {
                llmStatus.textContent = '✅ Response ready! Listen below 👇';
                llmStatus.className = 'status ready';
            }
            
            // Set up audio playback
            if (llmAudioPlayback && data.audio_url) {
                llmAudioPlayback.src = data.audio_url;
                llmAudioPlayback.style.display = 'block';
                
                // Auto-play the response
                setTimeout(() => {
                    llmAudioPlayback.play().catch(e => {
                        console.log("Auto-play prevented by browser, user needs to click play");
                    });
                }, 500);
            }
            
            isWaitingForResponse = false;
            
        } else {
            console.error("Chat agent failed:", data.error);
            // Use the server's error message
            throw new Error(data.error || 'Chat processing failed');
        }
        
    } catch (error) {
        handleChatError(error);
    }
}

// Add chat message to the chat container
function addChatMessage(type, text, animate = true) {
    if (!chatContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}-message`;
    if (animate) messageDiv.style.opacity = '0';
    
    const label = type === 'user' ? '👤 You:' : '🤖 AI:';
    const timestamp = new Date().toLocaleTimeString();
    
    messageDiv.innerHTML = `
        <div class="message-label">${label}</div>
        <div class="message-text">${text}</div>
        <div class="message-timestamp">${timestamp}</div>
    `;
    
    chatContainer.appendChild(messageDiv);
    
    // Animate in
    if (animate) {
        setTimeout(() => {
            messageDiv.style.opacity = '1';
        }, 100);
    }
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Enhanced error handling for Chat Agent
function handleChatError(error) {
    console.error('Chat Agent Error:', error);
    
    // Hide thinking dots
    if (thinkingDots) {
        thinkingDots.style.display = 'none';
    }
    
    let errorMessage = 'Something went wrong. Please try again.';
    
    // Check for specific error messages first
    if (error.message.includes('No speech detected')) {
        errorMessage = '🎤 No speech detected in your recording. Please speak clearly and try again.';
    } else if (error.message.includes('Transcription failed')) {
        errorMessage = '🎤 Could not understand your speech. Please speak more clearly and try again.';
    } else if (error.message.includes('401')) {
        errorMessage = 'API key error. Please check your configuration.';
    } else if (error.message.includes('429')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
    } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later.';
    } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
    }
    
    if (llmStatus) {
        llmStatus.textContent = `❌ ${errorMessage}`;
        llmStatus.className = 'status error';
    }
    
    // Reset UI state
    if (llmStartBtn) llmStartBtn.disabled = false;
    if (llmStopBtn) llmStopBtn.disabled = true;
    isWaitingForResponse = false;
}

// Initialize all components when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing all components...");
    
    // Initialize Echo Bot
    initEchoBot();
    
    // Initialize Enhanced Chat Agent
    initChatAgent();
    
    console.log("All components initialized successfully!");
});

// Enhanced utility functions
window.voiceAgentUtils = {
    getCurrentSession: function() {
        return {
            sessionId: currentSessionId,
            isRecording: chatIsRecording,
            isWaiting: isWaitingForResponse
        };
    },
    
    createNewSession: createNewSession,
    
    clearCurrentChat: clearCurrentChatHistory,
    
    testMicrophone: async function() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("Microphone test successful!");
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error("Microphone test failed:", error);
            return false;
        }
    },
    
    exportChatHistory: async function() {
        if (!currentSessionId) return null;
        
        try {
            const response = await fetch(`/agent/chat/${currentSessionId}/history`);
            const data = await response.json();
            
            if (data.success) {
                const blob = new Blob([JSON.stringify(data.chat_history, null, 2)], 
                    { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chat-history-${currentSessionId}.json`;
                a.click();
                URL.revokeObjectURL(url);
                return data.chat_history;
            }
        } catch (error) {
            console.error('Error exporting chat history:', error);
            return null;
        }
    }
};
console.log("💡 Try: voiceAgentUtils.getCurrentSession() to check current session");
console.log("💡 Try: voiceAgentUtils.createNewSession() to start fresh");
console.log("💡 Try: voiceAgentUtils.exportChatHistory() to download chat history");