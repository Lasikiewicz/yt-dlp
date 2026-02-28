document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------------
    // Elements - Single Form
    // --------------------------------------------------------
    const singleForm = document.getElementById('download-form');
    const urlInput = document.getElementById('url-input');
    const resolutionSelect = document.getElementById('resolution-select');
    const threadsInput = document.getElementById('threads-input');
    const locationInput = document.getElementById('location-input');
    const browseBtn = document.getElementById('browse-btn');
    const themeSelect = document.getElementById('theme-select');
    const closeBtn = document.getElementById('btn-close');

    // --------------------------------------------------------
    // Top-Right Controls Logic
    // --------------------------------------------------------
    if (closeBtn) {
        closeBtn.addEventListener('click', async () => {
            try { await fetch('/api/shutdown', { method: 'POST' }); } catch (e) { }
            document.body.innerHTML = '<div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; color: var(--text-main);"><h1 style="font-family: \'JetBrains Mono\', monospace; margin-bottom: 1rem;">Server Closed</h1><p>You can now safely close this window.</p></div>';
            setTimeout(() => window.close(), 1000);
        });
    }

    // --------------------------------------------------------
    // LocalStorage Configuration Loading
    // --------------------------------------------------------
    if (localStorage.getItem('ytTheme')) {
        const t = localStorage.getItem('ytTheme');
        themeSelect.value = t;
        document.documentElement.setAttribute('data-theme', t);
    }
    if (localStorage.getItem('ytResolution')) {
        resolutionSelect.value = localStorage.getItem('ytResolution');
    }
    if (localStorage.getItem('ytThreads')) {
        threadsInput.value = localStorage.getItem('ytThreads');
    }
    if (localStorage.getItem('ytLocation')) {
        locationInput.value = localStorage.getItem('ytLocation');
    }

    // --------------------------------------------------------
    // LocalStorage Event Listeners
    // --------------------------------------------------------
    themeSelect.addEventListener('change', (e) => {
        const t = e.target.value;
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('ytTheme', t);
    });

    threadsInput.addEventListener('change', (e) => {
        localStorage.setItem('ytThreads', e.target.value);
    });

    locationInput.addEventListener('change', (e) => {
        localStorage.setItem('ytLocation', e.target.value);
    });

    // --------------------------------------------------------
    // Elements - Tabs
    // --------------------------------------------------------
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    resolutionSelect.addEventListener('change', (e) => {
        localStorage.setItem('ytResolution', e.target.value);
        const selects = document.querySelectorAll('.item-resolution');
        selects.forEach(select => {
            select.value = e.target.value;
        });
    });

    // --------------------------------------------------------
    // Elements - Channel Explorer
    // --------------------------------------------------------
    const channelForm = document.getElementById('channel-form');
    const channelUrlInput = document.getElementById('channel-url-input');
    const channelLoadBtn = document.getElementById('channel-load-btn');
    const videoGrid = document.getElementById('video-grid');
    const channelToolbar = document.getElementById('channel-toolbar');
    const paginationControls = document.getElementById('pagination-controls');

    const selectAllBtn = document.getElementById('select-all-btn');
    const queueSelectedBtn = document.getElementById('queue-selected-btn');

    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageIndicator = document.getElementById('page-indicator');

    // --------------------------------------------------------
    // Elements - Queue Status
    // --------------------------------------------------------
    const statusContainer = document.getElementById('status-container');
    const videoInfo = document.getElementById('video-info');
    const progressFill = document.getElementById('progress-fill');
    const percentVal = document.getElementById('percent-val');
    const speedVal = document.getElementById('speed-val');
    const downloadedVal = document.getElementById('downloaded-val');
    const etaVal = document.getElementById('eta-val');
    const threadsContainer = document.getElementById('threads-container');
    const pendingList = document.getElementById('queue-pending-list');
    const historyList = document.getElementById('queue-history-list');

    // --------------------------------------------------------
    // Download History State
    // --------------------------------------------------------
    let downloadHistory = JSON.parse(localStorage.getItem('ytHistory') || '[]');

    function renderHistory() {
        if (!historyList) return;
        historyList.innerHTML = '';
        if (downloadHistory.length === 0) {
            historyList.innerHTML = '<div class="empty-queue" id="history-empty">No history.</div>';
            return;
        }

        [...downloadHistory].reverse().forEach(item => {
            const div = document.createElement('div');
            div.className = 'queue-item';
            div.style.opacity = '0.6';
            div.innerHTML = `
                <span class="queue-item-title" style="text-decoration: line-through;">${item.title}</span>
                <span class="queue-item-res" style="color: var(--success); border: 1px dashed var(--success); background: transparent; padding: 2px 4px; border-radius: 4px;">Done</span>
            `;
            historyList.appendChild(div);
        });
    }

    // Initial Render
    renderHistory();

    // --------------------------------------------------------
    // Elements - Queue Controls
    // --------------------------------------------------------
    const startQueueBtn = document.getElementById('start-queue-btn');
    const pauseQueueBtn = document.getElementById('pause-queue-btn');

    // --------------------------------------------------------
    // Globals
    // --------------------------------------------------------
    let ws = null;
    let activeFragments = {};
    let progressHistory = [];

    let currentChannelUrl = "";
    let currentPage = 1;
    let loadedVideos = [];

    // --- Tab Switching ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // --- Directory Browser ---
    if (browseBtn) {
        browseBtn.addEventListener('click', async () => {
            browseBtn.disabled = true;
            browseBtn.textContent = '...';
            try {
                const res = await fetch('/api/select-folder');
                const data = await res.json();
                if (data.path) {
                    locationInput.value = data.path;
                }
            } catch (err) {
                console.error("Failed to select folder:", err);
            } finally {
                browseBtn.disabled = false;
                browseBtn.textContent = 'Browse...';
            }
        });
    }

    // --- Helpers ---
    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    function formatTime(seconds) {
        if (!seconds || !Number.isFinite(seconds)) return '--:--';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const pad = (num) => num.toString().padStart(2, '0');
        if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
        return `${pad(m)}:${pad(s)}`;
    }

    function formatDuration(seconds) {
        if (!seconds || !Number.isFinite(seconds)) return '';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const pad = (num) => num.toString().padStart(2, '0');
        if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
        return `${m}:${pad(s)}`;
    }

    function resetActiveStatus(msg = "Preparing download...") {
        statusContainer.classList.remove('hidden', 'success', 'error');
        progressFill.style.width = '0%';
        percentVal.textContent = '0%';
        speedVal.textContent = '0 MB/s';
        downloadedVal.textContent = '0 MB';
        etaVal.textContent = '--:--';
        videoInfo.textContent = msg;
        videoInfo.style.color = '#e2e8f0';
        threadsContainer.style.display = 'none';
        threadsContainer.innerHTML = '';
        activeFragments = {};
        progressHistory = [];
    }

    function renderQueuePending(pendingArr) {
        pendingList.innerHTML = '';
        if (!pendingArr || pendingArr.length === 0) {
            pendingList.innerHTML = '<div class="empty-queue">No videos in queue.</div>';
            return;
        }

        pendingArr.forEach(item => {
            const div = document.createElement('div');
            div.className = 'queue-item';
            div.innerHTML = `
                <span class="queue-item-title">${item.title || item.url}</span>
                <span class="queue-item-res">${item.resolution}</span>
            `;
            pendingList.appendChild(div);
        });
    }

    // --- WebSocket Global Connection ---
    function connectWS() {
        if (ws) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

        ws.onmessage = (event) => {
            let data;
            try { data = JSON.parse(event.data); } catch (e) { return; }

            // Handle Queue Toggle State
            if (data.is_paused !== undefined) {
                if (data.is_paused) {
                    if (startQueueBtn) startQueueBtn.style.display = 'block';
                    if (pauseQueueBtn) pauseQueueBtn.style.display = 'none';
                } else {
                    if (startQueueBtn) startQueueBtn.style.display = 'none';
                    if (pauseQueueBtn) pauseQueueBtn.style.display = 'block';
                }
            }

            if (data.status === 'state') {
                if (data.active) {
                    resetActiveStatus(`Downloading: ${data.active.title || data.active.url}`);
                }
                renderQueuePending(data.pending);
            }
            else if (data.status === 'queue_update') {
                renderQueuePending(data.pending);
            }
            else if (data.status === 'queue_started') {
                statusContainer.classList.remove('hidden');
                resetActiveStatus(`Downloading: ${data.item.title || data.item.url}`);
                if (data.pending) renderQueuePending(data.pending);
            }
            else if (data.status === 'downloading') {
                statusContainer.classList.remove('hidden');
                progressFill.style.width = `${data.percent}%`;
                percentVal.textContent = `${data.percent}%`;

                if (data.fragment_index) activeFragments[data.fragment_index] = Date.now();
                let now = Date.now();
                let activeKeys = Object.keys(activeFragments).filter(k => now - activeFragments[k] < 1500);

                let threadsNum = parseInt(threadsInput.value, 10) || 1;
                if (activeKeys.length > 0 && threadsNum > 1) {
                    threadsContainer.style.display = 'flex';
                    threadsContainer.innerHTML = '';
                    activeKeys.forEach(k => {
                        let pill = document.createElement('div');
                        pill.className = 'thread-pill';
                        pill.textContent = `Thread (Frag ${k})`;
                        threadsContainer.appendChild(pill);
                    });
                } else {
                    threadsContainer.style.display = 'none';
                    threadsContainer.innerHTML = '';
                }

                progressHistory.push({ time: now, bytes: data.downloaded_bytes });
                progressHistory = progressHistory.filter(h => now - h.time <= 3000);

                let smoothedSpeed = 0;
                if (progressHistory.length > 1) {
                    let oldest = progressHistory[0];
                    let newest = progressHistory[progressHistory.length - 1];
                    let diffBytes = newest.bytes - oldest.bytes;
                    let diffSecs = (newest.time - oldest.time) / 1000.0;
                    if (diffSecs > 0 && diffBytes > 0) smoothedSpeed = diffBytes / diffSecs;
                } else {
                    smoothedSpeed = data.speed || 0;
                }

                let finalSpeed = (threadsNum > 1) ? smoothedSpeed : (data.speed || smoothedSpeed);
                speedVal.textContent = `${formatBytes(finalSpeed)}/s`;

                if (threadsNum > 1 && finalSpeed > 0 && data.total_bytes > 0) {
                    let remaining = data.total_bytes - data.downloaded_bytes;
                    etaVal.textContent = formatTime(remaining / finalSpeed);
                } else {
                    etaVal.textContent = formatTime(data.eta);
                }

                if (data.total_bytes > 0) {
                    downloadedVal.textContent = `${formatBytes(data.downloaded_bytes)} / ${formatBytes(data.total_bytes)}`;
                } else {
                    downloadedVal.textContent = `${formatBytes(data.downloaded_bytes)}`;
                }

                if (data.filename) {
                    const displayFilename = data.filename.split(/[/\\]/).pop();
                    videoInfo.textContent = `Downloading: ${displayFilename}`;
                }
            }
            else if (data.status === 'finished') {
                statusContainer.classList.add('success');
                progressFill.style.width = '100%';
                percentVal.textContent = '100%';
                speedVal.textContent = '--';
                etaVal.textContent = 'Done';
                let finalTitle = "";
                if (data.filename) {
                    const displayFilename = data.filename.split(/[/\\]/).pop();
                    videoInfo.textContent = `Completed: ${displayFilename}`;
                    finalTitle = displayFilename;
                } else {
                    videoInfo.textContent = 'Download Complete!';
                    finalTitle = (data.item && (data.item.title || data.item.url)) || "Unknown";
                }

                // Add to history
                downloadHistory.push({ title: finalTitle });
                if (downloadHistory.length > 50) downloadHistory.shift();
                localStorage.setItem('ytHistory', JSON.stringify(downloadHistory));
                renderHistory();

                // Keep success visual for 3s then hide if queue empty, or let next queue item overwrite it
                setTimeout(() => {
                    if (statusContainer.classList.contains('success')) {
                        statusContainer.classList.add('hidden');
                    }
                }, 4000);
            }
            else if (data.status === 'error') {
                statusContainer.classList.add('error');
                videoInfo.textContent = `Error: ${data.message}`;
                videoInfo.style.color = 'var(--error)';
            }

            // Single URL Input UX cleanup
            const downloadBtn = document.getElementById('download-btn');
            const btnText = document.querySelector('.btn-text');
            const loader = document.querySelector('.loader');
            btnText.style.display = 'block';
            loader.style.display = 'none';
            downloadBtn.disabled = false;
            urlInput.disabled = false;
        };

        ws.onclose = () => { ws = null; setTimeout(connectWS, 3000); };
    }

    connectWS();

    // --- Single Download Form Submit ---
    singleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = urlInput.value.trim();
        if (!url) return;

        // UI Feedback
        const downloadBtn = document.getElementById('download-btn');
        const btnText = document.querySelector('.btn-text');
        const loader = document.querySelector('.loader');

        btnText.style.display = 'none';
        loader.style.display = 'block';
        downloadBtn.disabled = true;
        urlInput.disabled = true;

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                url: url,
                resolution: resolutionSelect.value,
                threads: parseInt(threadsInput.value, 10) || 1,
                location: locationInput.value.trim()
            }));

            urlInput.value = '';
            setTimeout(() => {
                btnText.style.display = 'block';
                loader.style.display = 'none';
                downloadBtn.disabled = false;
                urlInput.disabled = false;
            }, 500);
        }
    });

    // --- Channel Explorer logic ---
    channelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = channelUrlInput.value.trim();
        if (!url) return;

        currentChannelUrl = url;
        currentPage = 1;
        await loadChannelVideos();
    });

    async function loadChannelVideos() {
        const btnText = channelLoadBtn.querySelector('.btn-text');
        const loader = channelLoadBtn.querySelector('.loader');

        btnText.style.display = 'none';
        loader.style.display = 'block';
        channelLoadBtn.disabled = true;
        channelUrlInput.disabled = true;
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;

        videoGrid.innerHTML = '';

        try {
            const res = await fetch(`/api/channel/info?url=${encodeURIComponent(currentChannelUrl)}&page=${currentPage}`);
            const data = await res.json();

            if (data.status === 'success' && data.entries) {
                loadedVideos = data.entries;
                renderVideoGrid(loadedVideos);

                channelToolbar.style.display = 'flex';
                paginationControls.style.display = 'flex';
                pageIndicator.textContent = `Page ${currentPage}`;

                prevPageBtn.disabled = currentPage <= 1;
                nextPageBtn.disabled = loadedVideos.length < 20;
            } else {
                videoGrid.innerHTML = `<div style="color:var(--error); grid-column:1/-1;">Error parsing channel: ${data.message || 'No videos found'}</div>`;
                channelToolbar.style.display = 'none';
                paginationControls.style.display = 'none';
            }
        } catch (err) {
            console.error(err);
            videoGrid.innerHTML = `<div style="color:var(--error); grid-column:1/-1;">Network error fetching channel info.</div>`;
        } finally {
            btnText.style.display = 'block';
            loader.style.display = 'none';
            channelLoadBtn.disabled = false;
            channelUrlInput.disabled = false;
        }
    }

    function renderVideoGrid(videos) {
        videoGrid.innerHTML = '';
        videos.forEach((vid, idx) => {
            const card = document.createElement('div');
            card.className = 'video-card';

            const thumbUrl = (vid.thumbnails && vid.thumbnails.length > 0) ? vid.thumbnails[vid.thumbnails.length - 1].url : '';
            const durationTxt = formatDuration(vid.duration);

            const isPlaylist = vid.is_playlist;
            const actionOverlay = isPlaylist
                ? `<div class="browse-overlay"><button type="button" class="browse-playlist-btn" data-url="${vid.url}">Browse Folder</button></div>`
                : `<input type="checkbox" class="video-checkbox" data-idx="${idx}">`;

            card.innerHTML = `
                ${actionOverlay}
                <div class="video-thumb-container">
                    <img src="${thumbUrl}" class="video-thumbnail" alt="thumbnail" onerror="this.style.opacity='0'">
                    ${durationTxt ? `<span class="video-duration">${durationTxt}</span>` : ''}
                </div>
                <div class="video-info-box">
                    <div class="video-title" title="${vid.title}">${vid.title || 'Untitled Video'}</div>
                    ${!isPlaylist ? `
                    <select class="item-resolution">
                        <option value="best">Best Available</option>
                        <option value="1080">1080p</option>
                        <option value="720">720p</option>
                        <option value="480">480p</option>
                        <option value="audio">Audio Only</option>
                    </select>
                    ` : ''}
                </div>
            `;

            if (isPlaylist) {
                card.classList.add('is-playlist');
                const browseBtn = card.querySelector('.browse-playlist-btn');
                const triggerBrowse = (e) => {
                    e.stopPropagation();
                    channelUrlInput.value = vid.url;
                    currentChannelUrl = vid.url;
                    currentPage = 1;
                    loadChannelVideos();
                };
                if (browseBtn) browseBtn.addEventListener('click', triggerBrowse);
                card.addEventListener('click', triggerBrowse);
            } else {
                card.addEventListener('click', (e) => {
                    if (e.target.tagName !== 'INPUT' && !e.target.classList.contains('browse-playlist-btn')) {
                        const cb = card.querySelector('.video-checkbox');
                        if (cb) {
                            cb.checked = !cb.checked;
                            card.classList.toggle('selected', cb.checked);
                        }
                    }
                });

                const cb = card.querySelector('.video-checkbox');
                if (cb) {
                    cb.addEventListener('change', () => {
                        card.classList.toggle('selected', cb.checked);
                    });
                }
            }

            videoGrid.appendChild(card);
        });
    }

    selectAllBtn.addEventListener('click', () => {
        const checkboxes = videoGrid.querySelectorAll('.video-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
            cb.closest('.video-card').classList.toggle('selected', !allChecked);
        });
        selectAllBtn.textContent = allChecked ? "Select All" : "Deselect All";
    });

    queueSelectedBtn.addEventListener('click', () => {
        const checkboxes = videoGrid.querySelectorAll('.video-checkbox:checked');
        if (checkboxes.length === 0) return;

        const thr = parseInt(threadsInput.value, 10) || 1;
        const loc = locationInput.value.trim();

        checkboxes.forEach(cb => {
            const idx = cb.getAttribute('data-idx');
            const vid = loadedVideos[idx];
            const card = cb.closest('.video-card');
            const resSelect = card.querySelector('.item-resolution');
            const res = resSelect ? resSelect.value : 'best';

            if (vid && vid.url && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    url: vid.url,
                    title: vid.title,
                    resolution: res,
                    threads: thr,
                    location: loc
                }));
            }
            cb.checked = false;
            cb.closest('.video-card').classList.remove('selected');
        });

        selectAllBtn.textContent = "Select All";
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadChannelVideos();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        currentPage++;
        loadChannelVideos();
    });

    if (startQueueBtn) {
        startQueueBtn.addEventListener('click', () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'start_queue' }));
            }
        });
    }

    if (pauseQueueBtn) {
        pauseQueueBtn.addEventListener('click', () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'pause_queue' }));
            }
        });
    }
});
