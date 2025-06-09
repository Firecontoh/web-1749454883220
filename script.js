document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const fileInput = document.getElementById('fileInput');
    const uploadedFilesPreview = document.getElementById('uploadedFilesPreview');
    const clearChatUIBtn = document.getElementById('clearChatUIBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // !!! PERHATIAN: API Key ini akan terlihat oleh pengguna karena ini adalah aplikasi sisi klien.
    // Untuk penggunaan produksi yang aman, sangat disarankan menggunakan proxy backend untuk menyembunyikan API key Anda.
    const GEMINI_API_KEY = 'AIzaSyDKCOPVTAE5ArvAQjW24S5jWpcEd1r5wew';
    const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

    let conversationHistory = []; // Menyimpan riwayat percakapan untuk memori sesi
    let uploadedFiles = []; // Menyimpan file yang dipilih pengguna untuk pesan saat ini

    // --- Utility Functions ---

    /**
     * Menampilkan overlay loading.
     */
    function showLoadingOverlay() {
        loadingOverlay.classList.add('show');
    }

    /**
     * Menyembunyikan overlay loading.
     */
    function hideLoadingOverlay() {
        loadingOverlay.classList.remove('show');
    }

    /**
     * Membersihkan input teks dari potensi XSS.
     * @param {string} text - Teks yang akan dibersihkan.
     * @returns {string} Teks yang sudah dibersihkan.
     */
    function sanitizeInput(text) {
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
    }

    /**
     * Memformat respons dari Gemini API menjadi HTML yang lebih mudah dibaca.
     * Mendukung bold, italic, inline code, code blocks, dan daftar sederhana.
     * @param {string} text - Teks respons dari Gemini.
     * @returns {string} Teks yang diformat dalam HTML.
     */
    function formatGeminiResponse(text) {
        // Handle bold: **text**
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Handle italic: *text*
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Handle inline code: `code`
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Handle code blocks: ```code```
        text = text.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');
        // Handle lists: - item
        // This is a basic approach and might need more robustness for complex markdown lists.
        const lines = text.split('\n');
        let inList = false;
        let formattedLines = lines.map(line => {
            if (line.trim().startsWith('- ')) {
                if (!inList) {
                    inList = true;
                    return `<ul><li>${line.trim().substring(2)}</li>`;
                }
                return `<li>${line.trim().substring(2)}</li>`;
            } else {
                if (inList) {
                    inList = false;
                    return `</ul>${line}`;
                }
                return line;
            }
        });
        if (inList) formattedLines.push('</ul>'); // Close last list if it ended abruptly

        text = formattedLines.join('\n');
        // Handle new lines
        text = text.replace(/\n/g, '<br>');
        return text;
    }

    /**
     * Mengatur tinggi textarea secara otomatis berdasarkan kontennya.
     */
    function autoResizeTextarea() {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    }

    /**
     * Menggulir area chat ke paling bawah.
     */
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // --- Chat UI Functions ---

    /**
     * Menambahkan pesan ke antarmuka chat.
     * @param {string} sender - Pengirim pesan ('user' atau 'ai').
     * @param {string} text - Konten teks pesan.
     * @param {boolean} [isTyping=false] - Apakah ini adalah indikator mengetik.
     * @param {Array<Object>} [media=[]] - Array objek media untuk ditampilkan (misalnya: {type: 'image', url: '...'}).
     * @returns {HTMLElement} Elemen pesan yang ditambahkan.
     */
    function appendMessage(sender, text, isTyping = false, media = []) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);

        if (isTyping) {
            messageDiv.classList.add('typing-indicator');
            messageDiv.innerHTML = '<span></span><span></span><span></span>';
        } else {
            const bubbleDiv = document.createElement('div');
            bubbleDiv.classList.add('message-bubble');

            if (media.length > 0) {
                media.forEach(item => {
                    if (item.type === 'image' && item.url) {
                        const img = document.createElement('img');
                        img.src = item.url;
                        img.alt = 'Uploaded Image';
                        img.style.maxWidth = '100%';
                        img.style.height = 'auto';
                        img.style.borderRadius = '10px';
                        img.style.marginBottom = text ? '10px' : '0';
                        bubbleDiv.appendChild(img);
                    } else if (item.type === 'file' && item.name) {
                        const fileInfo = document.createElement('div');
                        fileInfo.classList.add('file-attachment');
                        const icon = document.createElement('i');
                        // Basic icons for common file types
                        if (item.name.toLowerCase().includes('.pdf')) icon.classList.add('fas', 'fa-file-pdf');
                        else if (item.name.toLowerCase().includes('.doc') || item.name.toLowerCase().includes('.docx')) icon.classList.add('fas', 'fa-file-word');
                        else if (item.name.toLowerCase().includes('.xls') || item.name.toLowerCase().includes('.xlsx')) icon.classList.add('fas', 'fa-file-excel');
                        else if (item.name.toLowerCase().includes('.txt')) icon.classList.add('fas', 'fa-file-alt');
                        else if (item.name.toLowerCase().includes('.mp4') || item.name.toLowerCase().includes('.mov')) icon.classList.add('fas', 'fa-file-video');
                        else icon.classList.add('fas', 'fa-file'); // Generic file icon
                        
                        const fileNameSpan = document.createElement('span');
                        fileNameSpan.textContent = item.name;
                        fileInfo.appendChild(icon);
                        fileInfo.appendChild(fileNameSpan);
                        bubbleDiv.appendChild(fileInfo);
                    }
                });
            }

            if (text) {
                const p = document.createElement('p');
                p.innerHTML = formatGeminiResponse(text);
                bubbleDiv.appendChild(p);
            }
            messageDiv.appendChild(bubbleDiv);
        }

        chatMessages.appendChild(messageDiv);
        messageDiv.classList.add('entry-animation'); // Memicu animasi CSS
        setTimeout(scrollToBottom, 100); // Penundaan kecil untuk memungkinkan animasi sebelum scroll
        return messageDiv; // Mengembalikan elemen untuk pembaruan potensial (seperti indikator mengetik)
    }

    /**
     * Menghapus indikator mengetik dari UI.
     * @param {HTMLElement} indicatorElement - Elemen indikator mengetik yang akan dihapus.
     */
    function removeTypingIndicator(indicatorElement) {
        if (indicatorElement) {
            indicatorElement.remove();
        }
    }

    // --- File Handling ---

    /**
     * Merender preview file yang diunggah ke area preview.
     */
    function renderFilePreview() {
        uploadedFilesPreview.innerHTML = '';
        if (uploadedFiles.length === 0) {
            uploadedFilesPreview.classList.remove('has-files');
            return;
        }
        uploadedFilesPreview.classList.add('has-files');

        uploadedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.classList.add('file-preview-item');

            let content;
            if (file.type.startsWith('image/')) {
                content = document.createElement('img');
                content.src = URL.createObjectURL(file);
                content.alt = file.name;
            } else {
                content = document.createElement('i');
                content.classList.add('file-icon');
                if (file.type.includes('pdf')) content.classList.add('fas', 'fa-file-pdf');
                else if (file.type.includes('word') || file.type.includes('document')) content.classList.add('fas', 'fa-file-word');
                else if (file.type.includes('excel') || file.type.includes('spreadsheet')) content.classList.add('fas', 'fa-file-excel');
                else if (file.type.includes('text')) content.classList.add('fas', 'fa-file-alt');
                else if (file.type.includes('video')) content.classList.add('fas', 'fa-file-video');
                else content.classList.add('fas', 'fa-file'); // Generic file icon
                content.title = file.name;
            }
            item.appendChild(content);

            const removeBtn = document.createElement('button');
            removeBtn.classList.add('remove-file-btn');
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.onclick = () => removeFileFromPreview(index);
            item.appendChild(removeBtn);

            uploadedFilesPreview.appendChild(item);
        });
        scrollToBottom(); // Scroll to ensure preview is visible
    }

    /**
     * Menghapus file dari daftar preview dan array uploadedFiles.
     * @param {number} index - Indeks file yang akan dihapus.
     */
    function removeFileFromPreview(index) {
        // Revoke URL object to free memory if it was an image preview
        if (uploadedFiles[index] && uploadedFiles[index].type.startsWith('image/')) {
            URL.revokeObjectURL(uploadedFilesPreview.children[index].querySelector('img').src);
        }
        uploadedFiles.splice(index, 1);
        renderFilePreview();
        fileInput.value = ''; // Mengosongkan input file untuk memungkinkan pengunggahan ulang file yang sama
    }

    /**
     * Mengkonversi objek File menjadi string Base64.
     * @param {File} file - Objek File yang akan dikonversi.
     * @returns {Promise<string>} Promise yang resolve dengan string Base64.
     */
    async function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]); // Ambil string base64 tanpa prefix data URI
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }

    // --- API Call Logic ---

    /**
     * Mengirim pesan pengguna ke Gemini API dan menampilkan responsnya.
     */
    async function sendMessage() {
        const userMessageText = messageInput.value.trim();
        const hasFiles = uploadedFiles.length > 0;

        if (!userMessageText && !hasFiles) {
            // Animasi atau pemberitahuan UI yang lebih baik bisa diimplementasikan di sini
            alert('Mohon masukkan pesan atau unggah file.');
            return;
        }

        // Nonaktifkan input dan tombol selama panggilan API
        messageInput.disabled = true;
        sendMessageBtn.disabled = true;
        fileInput.disabled = true;
        showLoadingOverlay();

        const userMessageParts = [];
        if (userMessageText) {
            userMessageParts.push({ text: userMessageText });
        }

        const mediaPreviews = []; // Untuk ditampilkan di UI chat
        if (hasFiles) {
            for (const file of uploadedFiles) {
                try {
                    const base64Data = await fileToBase64(file);
                    userMessageParts.push({
                        inlineData: {
                            mimeType: file.type,
                            data: base64Data
                        }
                    });
                    if (file.type.startsWith('image/')) {
                        mediaPreviews.push({ type: 'image', url: URL.createObjectURL(file) });
                    } else {
                        mediaPreviews.push({ type: 'file', name: file.name });
                    }
                } catch (error) {
                    console.error('Error converting file to base64:', error);
                    alert(`Gagal memproses file ${file.name}. Mohon coba lagi.`);
                    hideLoadingOverlay();
                    messageInput.disabled = false;
                    sendMessageBtn.disabled = false;
                    fileInput.disabled = false;
                    return; // Berhenti jika pemrosesan file gagal
                }
            }
        }

        // Tambahkan pesan pengguna ke riwayat percakapan
        conversationHistory.push({
            role: 'user',
            parts: userMessageParts
        });

        // Tampilkan pesan pengguna di UI
        appendMessage('user', sanitizeInput(userMessageText), false, mediaPreviews);
        messageInput.value = '';
        autoResizeTextarea();
        uploadedFiles.forEach(file => {
            if (file.type.startsWith('image/')) {
                URL.revokeObjectURL(URL.createObjectURL(file)); // Clean up object URLs
            }
        });
        uploadedFiles = []; // Bersihkan file setelah dikirim
        renderFilePreview(); // Bersihkan preview

        const typingIndicator = appendMessage('ai', '', true); // Tampilkan indikator mengetik

        try {
            const response = await fetch(GEMINI_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: conversationHistory, // Kirim seluruh riwayat
                    generationConfig: {
                        temperature: 0.9,
                        topK: 1,
                        topP: 1,
                        maxOutputTokens: 2048,
                    },
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    ],
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Kesalahan API: ${response.status} - ${errorData.error.message || 'Kesalahan tidak diketahui'}`);
            }

            const data = await response.json();
            const aiMessageContent = data.candidates[0].content.parts[0].text;

            // Tambahkan pesan AI ke riwayat percakapan
            conversationHistory.push({
                role: 'model',
                parts: [{ text: aiMessageContent }]
            });

            removeTypingIndicator(typingIndicator);
            appendMessage('ai', aiMessageContent);

        } catch (error) {
            console.error('Error berkomunikasi dengan Gemini API:', error);
            removeTypingIndicator(typingIndicator);
            appendMessage('ai', `Maaf, saya tidak dapat memproses permintaan Anda saat ini. Error: ${error.message}`);
        } finally {
            hideLoadingOverlay();
            messageInput.disabled = false;
            sendMessageBtn.disabled = false;
            fileInput.disabled = false;
            messageInput.focus();
            scrollToBottom();
        }
    }

    // --- Event Listeners ---

    // Otomatis ubah ukuran textarea saat input
    messageInput.addEventListener('input', autoResizeTextarea);

    // Kirim pesan saat tombol Enter ditekan (tanpa Shift)
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Mencegah baris baru
            sendMessage();
        }
    });

    // Kirim pesan saat tombol Kirim diklik
    sendMessageBtn.addEventListener('click', sendMessage);

    // Tangani pemilihan file
    fileInput.addEventListener('change', (event) => {
        // Ambil file yang baru dipilih dan tambahkan ke daftar yang sudah ada
        const newFiles = Array.from(event.target.files);
        uploadedFiles.push(...newFiles);
        renderFilePreview();
    });

    // Tangani tombol bersihkan UI chat
    clearChatUIBtn.addEventListener('click', () => {
        // Hanya hapus pesan yang ditampilkan, biarkan conversationHistory tetap utuh
        const initialAiMessageDiv = chatMessages.querySelector('.ai-message.entry-animation'); // Cari pesan AI awal

        // Hapus semua pesan kecuali yang pertama (jika ada)
        while (chatMessages.firstChild) {
            if (chatMessages.firstChild !== initialAiMessageDiv) {
                chatMessages.removeChild(chatMessages.firstChild);
            } else if (chatMessages.children.length > 1) { // If it's not the only child, remove others
                chatMessages.removeChild(chatMessages.firstChild);
            } else {
                break; // If only initial message left, break
            }
        }
        // If initial message was removed (e.g. if it wasn't the first in the DOM, or all cleared)
        // or if it never existed (first load without initial HTML message)
        if (!chatMessages.contains(initialAiMessageDiv) || chatMessages.children.length === 0) {
             const newInitialMessage = document.createElement('div');
             newInitialMessage.classList.add('message', 'ai-message', 'entry-animation');
             const bubbleDiv = document.createElement('div');
             bubbleDiv.classList.add('message-bubble');
             const p = document.createElement('p');
             p.innerHTML = formatGeminiResponse('Halo! Saya Matsanela Ai, asisten edukasi Anda. Ada yang bisa saya bantu?');
             bubbleDiv.appendChild(p);
             newInitialMessage.appendChild(bubbleDiv);
             chatMessages.prepend(newInitialMessage); // Add to the beginning
        }

        scrollToBottom();
    });

    // --- Initial Setup ---
    autoResizeTextarea();
    scrollToBottom();
});