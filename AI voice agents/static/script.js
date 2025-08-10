// Get DOM elements for TTS
const form = document.getElementById('ttsForm');
const textInput = document.getElementById('textInput');
const voiceSelect = document.getElementById('voiceSelect');
const generateBtn = document.getElementById('generateBtn');
const resultArea = document.getElementById('resultArea');
const charCount = document.getElementById('charCount');

// TTS Character counter functionality
if (textInput && charCount) {
    textInput.addEventListener('input', function() {
        const count = this.value.length;
        charCount.textContent = count;
        
        // Change color when approaching limit
        if (count > 4500) {
            charCount.style.color = '#dc354c';
        } else {
            charCount.style.color = 'inherit';
        }
    });
}

// TTS Form submission handler
if (form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const text = textInput.value.trim();
        const voiceId = voiceSelect.value;
        
        // Validate input
        if (!text) {
            showResult('Please enter some text!', 'error');
            return;
        }
        
        // Show loading state
        generateBtn.disabled = true;
        generateBtn.textContent = '🔄 Generating...';
        showLoading();
        
        try {
            // Make API request
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    voiceid: voiceId,
                    style: "Inspirational"
                })
            });
            
            const data = await response.json();
            
            // Handle response
            if (data.success) {
                showSuccess(data.audio_url, data.message);
            } else {
                showResult(data.error || 'Failed to generate speech', 'error');
            }
            
        } catch (error) {
            console.error('Error:', error);
            showResult('Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            generateBtn.disabled = false;
            generateBtn.textContent = '🎵 Generate Speech';
        }
    });
}

// TTS Show loading animation
function showLoading() {
    if (resultArea) {
        resultArea.innerHTML = `
            <div class="loading"></div>
            <p>Generating your speech... Please wait</p>
        `;
    }
}

// TTS Show result message
function showResult(message, type) {
    if (resultArea) {
        const className = type === 'error' ? 'error-message' : 'success-message';
        resultArea.innerHTML = `<p class="${className}">${message}</p>`;
    }
}

// TTS Show success with audio player and download link
function showSuccess(audioUrl, message) {
    if (resultArea) {
        resultArea.innerHTML = `
            <p class="success-message">✅ ${message}</p>
            <audio controls>
                <source src="${audioUrl}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
            <a href="${audioUrl}" download="generated-speech.mp3" class="download-btn">
                📥 Download Audio
            </a>
        `;
    }
}


// =============================================================================
// ECHO BOT V2 FUNCTIONALITY - Now with Transcription + TTS
// =============================================================================


console.log("Echo Bot v2 script loaded");

// Echo Bot variables
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Get Echo Bot DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const audioPlayback = document.getElementById('audioPlayback');

// Log element status
console.log("Echo Bot elements:", {
    startBtn: !!startBtn,
    stopBtn: !!stopBtn,
    status: !!status,
    audioPlayback: !!audioPlayback,
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

// Echo Bot start recording function
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
        mediaRecorder = new MediaRecorder(stream);
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

// Echo Bot stop recording function
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

// Process audio with the new /tts/echo endpoint
async function processEchoAudio(audioBlob) {
    try {
        // Update status to show upload in progress
        if (status) {
            status.textContent = '🎯 Step 1: Transcribing your speech...';
            status.className = 'status processing';
        }

        //Get selected voice from the TTS form
        const selectedVoice = voiceSelect? voiceSelect.value : "en-US-Daniel";
        console.log("Selected Voice:", selectedVoice);
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('audio_file', audioBlob, 'echo_recording.webm');
        formData.append('voiceId', selectedVoice);
        
        // Call the new echo endpoint
        console.log("Calling /tts/echo endpoint...")
        const response = await fetch('/tts/echo', {
            method: 'POST',
            body: formData
        });
        
        console.log("Response status:", response.status);
        if(!response.ok){
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Echo response:", data);
        
        if (data.success) {
            console.log("Echo processing successful!");
            // Update status to show transcription result
            if (status) {
                status.textContent = `🎤 You said: "${data.transcribed_text}"`;
                status.className = 'status ready';
            }
            
            // Set up audio playback with the AI-generated voice
            if (audioPlayback && data.audio_url) {
                audioPlayback.src = data.audio_url;
                audioPlayback.style.display = 'block';
                console.log("Audio playback updated with AI voice");
                
                // Add some visual feedback
                setTimeout(() => {
                    if (status) {
                        status.textContent = `✅ ${data.message} - Playing back in AI voice!`;
                        status.className = 'status ready';
                    }
                }, 500);
            }

            //Show download option in Echo Bot container
            showEchoDownload(data.transcribed_text, data.audio_url);
            
        } else {
            console.error("Echo processing failed:", data.error);
            if (status) {
                status.textContent = `❌ Error: ${data.error || 'Echo processing failed'}`;
                status.className = 'status error';
            }
        }
        
    } catch (error) {
        console.error('Echo processing error:', error);
        if (status) {
            status.textContent = `❌ Network error: ${error.message}`;
            status.className = 'status error';
        }
    }
}

function showEchoDownload(transcribedText, audioUrl) {
    // Create or update the download area in the Echo Bot container
    const audioContainer = document.querySelector('.audio-container');
    if (audioContainer) {
        // Check if download area already exists
        let downloadArea = document.getElementById('echoDownloadArea');
        if (!downloadArea) {
            downloadArea = document.createElement('div');
            downloadArea.id = 'echoDownloadArea';
            downloadArea.style.marginTop = '20px';
            audioContainer.appendChild(downloadArea);
        }
        
        downloadArea.innerHTML = `
            <div style="text-align: center; padding: 15px; background: rgba(76, 175, 80, 0.1); border-radius: 10px; border: 1px solid rgba(76, 175, 80, 0.3);">
                <p style="margin-bottom: 10px;"><strong>📝 Transcription:</strong></p>
                <p style="font-style: italic; margin-bottom: 15px;">"${transcribedText}"</p>
                <a href="${audioUrl}" download="echo-ai-voice.mp3" class="download-btn">
                    📥 Download AI Voice
                </a>
            </div>
        `;
    }
}

// =============================================================================
// LLM CHAT BOT FUNCTIONALITY - Full Pipeline Implementation
// =============================================================================

console.log("LLM Chat Bot script loaded");

// LLM Chat Bot variables
let llmMediaRecorder;
let llmAudioChunks = [];
let llmIsRecording = false;

// Get LLM Chat Bot DOM elements
const llmStartBtn = document.getElementById('llmStartBtn');
const llmStopBtn = document.getElementById('llmStopBtn');
const llmStatus = document.getElementById('llmStatus');
const llmAudioPlayback = document.getElementById('llmAudioPlayback');
const llmVoiceSelect = document.getElementById('llmVoiceSelect');
const chatContainer = document.getElementById('chatContainer');

// Log LLM element status
console.log("LLM Chat Bot elements:", {
    llmStartBtn: !!llmStartBtn,
    llmStopBtn: !!llmStopBtn,
    llmStatus: !!llmStatus,
    llmAudioPlayback: !!llmAudioPlayback,
    llmVoiceSelect: !!llmVoiceSelect,
    chatContainer: !!chatContainer
});

// Initialize LLM Chat Bot
function initLLMChatBot() {
    console.log("Initializing LLM Chat Bot");
    
    // Set initial state
    if (llmStopBtn) llmStopBtn.disabled = true;
    if (llmStatus) {
        llmStatus.textContent = "Ready to chat - Click 'Start Recording' to ask me anything!";
        llmStatus.className = "status ready";
    }
    
    // Add event listeners
    if (llmStartBtn) {
        llmStartBtn.addEventListener('click', startLLMRecording);
        console.log("Added click event to LLM Start button");
    }
    
    if (llmStopBtn) {
        llmStopBtn.addEventListener('click', stopLLMRecording);
        console.log("Added click event to LLM Stop button");
    }
}

// LLM start recording function
async function startLLMRecording() {
    console.log("LLM start recording called");
    
    try {
        console.log("Requesting microphone access for LLM...");
        
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            } 
        });
        console.log("LLM microphone access granted");

        // Initialize MediaRecorder
        llmMediaRecorder = new MediaRecorder(stream);
        console.log("LLM MediaRecorder created");

        // Reset audio chunks
        llmAudioChunks = [];
        llmIsRecording = true;

        // Set up event listeners
        llmMediaRecorder.ondataavailable = (event) => {
            console.log("LLM data available event:", event.data.size);
            if (event.data.size > 0) {
                llmAudioChunks.push(event.data);
            }
        };

        llmMediaRecorder.onstop = async () => {
            console.log("LLM recording stopped");
            // Create blob from chunks
            const audioBlob = new Blob(llmAudioChunks, { type: 'audio/webm' });
            console.log("LLM audio blob created:", audioBlob.size, "bytes");

            await processLLMAudio(audioBlob);

            stream.getTracks().forEach(track => track.stop());
            console.log("LLM microphone released");
        };

        // Start recording
        llmMediaRecorder.start(100); // Collect data every 100ms
        console.log("LLM MediaRecorder started");
        llmIsRecording = true;

        // Update UI
        if (llmStartBtn) {
            llmStartBtn.disabled = true;
            console.log("LLM start button disabled");
        }
        if (llmStopBtn) {
            llmStopBtn.disabled = false;
            console.log("LLM stop button enabled");
        }
        if (llmStatus) {
            llmStatus.textContent = '🎙️ Recording your question... Speak clearly!';
            llmStatus.className = 'status recording';
            console.log("LLM status updated to 'recording'");
        }
        if (llmAudioPlayback) {
            llmAudioPlayback.style.display = 'none';
            console.log("LLM audio playback hidden");
        }

    } catch (error) {
        console.error('Error accessing microphone for LLM:', error);
        if (llmStatus) {
            llmStatus.textContent = `Error: ${error.message}`;
            llmStatus.className = 'status error';
            console.log("LLM error status displayed");
        }
    }
}

// LLM stop recording function
function stopLLMRecording() {
    console.log("LLM stop recording called");
    
    if (llmMediaRecorder && llmIsRecording) {
        llmMediaRecorder.stop();
        llmIsRecording = false;
        console.log("LLM MediaRecorder stopped");

        // Update UI
        if (llmStartBtn) {
            llmStartBtn.disabled = false;
            console.log("LLM start button enabled");
        }
        if (llmStopBtn) {
            llmStopBtn.disabled = true;
            console.log("LLM stop button disabled");
        }
        if (llmStatus) {
            llmStatus.textContent = 'Processing your question... AI is thinking!';
            llmStatus.className = 'status processing';
            console.log("LLM status updated to processing");
        }
    }
}

// Process audio with the new /llm/query endpoint - Full Pipeline!
async function processLLMAudio(audioBlob) {
    try {
        // Show processing steps
        showProcessingSteps();
        
        // Get selected voice
        const selectedVoice = llmVoiceSelect ? llmVoiceSelect.value : "en-US-Daniel";
        console.log("Selected AI Voice:", selectedVoice);
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('audio_file', audioBlob, 'llm_query.webm');
        formData.append('model', 'gemini-2.0-flash-exp');
        formData.append('voiceid', selectedVoice);
        
        // Update processing step
        updateProcessingStep(1, 'active');
        if (llmStatus) {
            llmStatus.textContent = '🎯 Step 1: Transcribing your question...';
            llmStatus.className = 'status processing';
        }
        
        // Call the LLM query endpoint - Full Pipeline!
        console.log("Calling /llm/query endpoint for full pipeline...");
        const response = await fetch('/llm/query', {
            method: 'POST',
            body: formData
        });
        
        console.log("LLM Response status:", response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("LLM pipeline response:", data);
        
        if (data.success) {
            console.log("LLM pipeline successful!");
            
            // Update processing steps
            updateProcessingStep(1, 'completed');
            updateProcessingStep(2, 'completed');
            updateProcessingStep(3, 'completed');
            
            // Add user message to chat
            addChatMessage('user', data.transcribed_text);
            
            // Add AI response to chat
            addChatMessage('ai', data.llm_response);
            
            // Update status
            if (llmStatus) {
                llmStatus.textContent = '✅ Complete! Listen to my response below 👇';
                llmStatus.className = 'status ready';
            }
            
            // Set up audio playback with the AI-generated response
            if (llmAudioPlayback && data.audio_url) {
                llmAudioPlayback.src = data.audio_url;
                llmAudioPlayback.style.display = 'block';
                console.log("LLM audio playback updated with AI response");
                
                // Auto-play the response
                setTimeout(() => {
                    llmAudioPlayback.play().catch(e => {
                        console.log("Auto-play prevented by browser, user needs to click play");
                    });
                }, 500);
            }

            // Show download option
            showLLMDownload(data.transcribed_text, data.llm_response, data.audio_url);
            
            // Clear processing steps after a delay
            setTimeout(() => {
                clearProcessingSteps();
            }, 3000);
            
        } else {
            console.error("LLM pipeline failed:", data.error);
            if (llmStatus) {
                llmStatus.textContent = `❌ Error: ${data.error || 'LLM processing failed'}`;
                llmStatus.className = 'status error';
            }
        }
        
    } catch (error) {
        console.error('LLM processing error:', error);
        if (llmStatus) {
            llmStatus.textContent = `❌ Network error: ${error.message}`;
            llmStatus.className = 'status error';
        }
    }
}

// Add chat message to the chat container
function addChatMessage(type, text) {
    if (!chatContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}-message`;
    
    const label = type === 'user' ? '👤 You asked:' : '🤖 AI responded:';
    
    messageDiv.innerHTML = `
        <div class="message-label">${label}</div>
        <div class="message-text">${text}</div>
    `;
    
    chatContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show processing steps animation
function showProcessingSteps() {
    if (!llmStatus) return;
    
    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'processing-steps';
    stepsContainer.id = 'processingSteps';
    stepsContainer.innerHTML = `
        <div class="step" id="step1">🎤 Transcribing your speech...</div>
        <div class="step" id="step2">🧠 AI is thinking about your question...</div>
        <div class="step" id="step3">🎵 Converting response to speech...</div>
    `;
    
    // Insert after status
    llmStatus.parentNode.insertBefore(stepsContainer, llmStatus.nextSibling);
}

// Update processing step status
function updateProcessingStep(stepNumber, status) {
    const step = document.getElementById(`step${stepNumber}`);
    if (step) {
        step.className = `step ${status}`;
        
        if (status === 'active') {
            // Update status message based on step
            if (stepNumber === 2 && llmStatus) {
                llmStatus.textContent = '🧠 Step 2: AI is thinking about your question...';
            } else if (stepNumber === 3 && llmStatus) {
                llmStatus.textContent = '🎵 Step 3: Converting AI response to speech...';
            }
        }
    }
}

// Clear processing steps
function clearProcessingSteps() {
    const stepsContainer = document.getElementById('processingSteps');
    if (stepsContainer) {
        stepsContainer.remove();
    }
}

// Show download option for LLM chat
function showLLMDownload(userText, aiResponse, audioUrl) {
    if (!llmAudioPlayback || !llmAudioPlayback.parentNode) return;
    
    const audioContainer = llmAudioPlayback.parentNode;
    
    // Check if download area already exists
    let downloadArea = document.getElementById('llmDownloadArea');
    if (!downloadArea) {
        downloadArea = document.createElement('div');
        downloadArea.id = 'llmDownloadArea';
        downloadArea.style.marginTop = '20px';
        audioContainer.appendChild(downloadArea);
    }
}

// Clear chat history function
function clearChatHistory() {
    if (chatContainer) {
        chatContainer.innerHTML = '';
        console.log("Chat history cleared");
    }
}

// Add clear chat button functionality
function addClearChatButton() {
    const llmContainer = document.querySelector('.container:last-of-type');
    if (llmContainer && !document.getElementById('clearChatBtn')) {
        const clearBtn = document.createElement('button');
        clearBtn.id = 'clearChatBtn';
        clearBtn.textContent = '🗑️ Clear Chat';
        clearBtn.className = 'generate-btn';
        clearBtn.style.marginTop = '10px';
        clearBtn.style.background = 'linear-gradient(45deg, #ff9800, #f57c00)';
        
        clearBtn.addEventListener('click', () => {
            clearChatHistory();
            if (llmStatus) {
                llmStatus.textContent = "Ready to chat - Click 'Start Recording' to ask me anything!";
                llmStatus.className = "status ready";
            }
        });
    }
}

// Enhanced error handling for LLM
function handleLLMError(error) {
    console.error('LLM Chat Bot Error:', error);
    
    let errorMessage = 'Something went wrong. Please try again.';
    
    if (error.message.includes('401')) {
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
    
    // Clear processing steps on error
    clearProcessingSteps();
    
    // Reset UI state
    if (llmStartBtn) llmStartBtn.disabled = false;
    if (llmStopBtn) llmStopBtn.disabled = true;
}

// Initialize all bots when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing all bots...");
    
    // Initialize Echo Bot
    initEchoBot();
    
    // Initialize LLM Chat Bot
    initLLMChatBot();
    
    // Add clear chat button
    addClearChatButton();
    
    console.log("All bots initialized successfully!");
});

// Add some helpful utilities
window.voiceAgentUtils = {
    clearAllChats: function() {
        clearChatHistory();
        console.log("All chats cleared via utility function");
    },
    
    getCurrentStatus: function() {
        return {
            echo: {
                isRecording: isRecording,
                status: status ? status.textContent : 'N/A'
            },
            llm: {
                isRecording: llmIsRecording,
                status: llmStatus ? llmStatus.textContent : 'N/A'
            }
        };
    },
    
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
    }
};

console.log("🎉 Voice Agents Day 9 - Complete LLM Pipeline loaded successfully!");
console.log("💡 Try: voiceAgentUtils.testMicrophone() to test your microphone");
console.log("💡 Try: voiceAgentUtils.getCurrentStatus() to check bot status");
console.log("💡 Try: voiceAgentUtils.clearAllChats() to clear all conversations");