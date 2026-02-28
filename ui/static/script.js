document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------------
    const tabSingle = document.getElementById('tab-single');
    const tabChannel = document.getElementById('tab-channel');

    const themeSelect = document.getElementById('theme-select');
    const closeBtn = document.getElementById('btn-close');

    // --------------------------------------------------------
    // Elements - Single Form
    // --------------------------------------------------------
    const singleSearchForm = document.getElementById('single-search-form');
    const urlInput = document.getElementById('url-input');
    const searchBtn = document.getElementById('search-btn');

    const singleVideoResult = document.getElementById('single-video-result');
    const singleThumb = document.getElementById('single-thumb');
    const singleTitle = document.getElementById('single-title');
    const singleDuration = document.getElementById('single-duration');
    const singleDownloadBtn = document.getElementById('single-download-btn');
    const globalChooseFolderBtn = document.getElementById('global-choose-folder-btn');
    const globalLocationPath = document.getElementById('global-location-path');
    const rememberLocationCb = document.getElementById('remember-location-cb');

    let currentSingleItem = null; // Store fetched data

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
    themeSelect.addEventListener('change', (e) => {
        const t = e.target.value;
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('ytTheme', t);
    });

    let rememberedLocation = localStorage.getItem('ytLastLocation');
    if (rememberedLocation && globalLocationPath && rememberLocationCb) {
        globalLocationPath.value = rememberedLocation;
        rememberLocationCb.checked = true;
        if (singleDownloadBtn) singleDownloadBtn.disabled = false;
    }

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
    const channelQualitySelect = document.getElementById('channel-quality-select');

    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageIndicator = document.getElementById('page-indicator');

    // --------------------------------------------------------
    // Global Navigation Logic
    // --------------------------------------------------------
    const navTabs = document.querySelectorAll('.nav-tab');

    function switchTab(target) {
        // Update tab buttons
        navTabs.forEach(tab => {
            if (tab.dataset.target === target) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update content panes
        tabSingle.style.display = 'none';
        tabChannel.style.display = 'none';

        const mainLayout = document.querySelector('.main-layout');
        const queueCard = document.querySelector('.queue-card');

        // Always show queue card and maintain grid layout
        if (mainLayout) mainLayout.classList.remove('single-column-mode');
        if (queueCard) queueCard.style.display = 'flex';

        if (target === 'single') {
            tabSingle.style.display = 'block';
        } else if (target === 'channel') {
            tabChannel.style.display = 'block';
        }
    }

    navTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            switchTab(e.target.dataset.target);
        });
    });

    // --------------------------------------------------------
    // Previous Channels Logic
    // --------------------------------------------------------
    let channelHistory = JSON.parse(localStorage.getItem('ytChannelHistory') || '[]');
    const previousChannelsDropdown = document.getElementById('previous-channels-dropdown');
    const previousChannelsList = document.getElementById('previous-channels-list');

    function saveChannelHistory() {
        localStorage.setItem('ytChannelHistory', JSON.stringify(channelHistory));
    }

    function addChannelToHistory(url, title) {
        // Remove existing if any to move it to top
        channelHistory = channelHistory.filter(c => c.url !== url);
        channelHistory.unshift({ url, title: title || url });
        if (channelHistory.length > 10) channelHistory.pop(); // Keep last 10
        saveChannelHistory();
        renderChannelHistory();
    }

    function renderChannelHistory() {
        if (!previousChannelsList || !previousChannelsDropdown) return;
        previousChannelsList.innerHTML = '';

        if (channelHistory.length === 0) {
            previousChannelsDropdown.style.display = 'none';
            return;
        }
        channelHistory.forEach(channel => {
            const div = document.createElement('div');
            div.className = 'previous-channel-item';
            div.innerHTML = `
                <div class="previous-channel-info" title="Load ${channel.title}">
                    <div class="previous-channel-title">${channel.title}</div>
                    <div class="previous-channel-url">${channel.url}</div>
                </div>
                <button type="button" class="remove-channel-btn" title="Remove from history" aria-label="Remove">
                    &#10005;
                </button>
            `;

            // Click on info to load
            const infoDiv = div.querySelector('.previous-channel-info');
            infoDiv.addEventListener('click', () => {
                channelUrlInput.value = channel.url;
                channelForm.dispatchEvent(new Event('submit'));
                previousChannelsDropdown.style.display = 'none';
            });

            // Click on remove btn
            const removeBtn = div.querySelector('.remove-channel-btn');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                channelHistory = channelHistory.filter(c => c.url !== channel.url);
                saveChannelHistory();
                renderChannelHistory();
            });

            previousChannelsList.appendChild(div);
        });
    }

    renderChannelHistory();

    // Toggle dropdown
    if (channelUrlInput && previousChannelsDropdown) {
        channelUrlInput.addEventListener('focus', () => {
            if (channelHistory.length > 0) {
                previousChannelsDropdown.style.display = 'block';
            }
        });

        // Hide dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!channelForm.contains(e.target)) {
                previousChannelsDropdown.style.display = 'none';
            }
        });
    }

    function resetSingleForm() {
        singleVideoResult.style.display = 'none';
        urlInput.value = '';
        currentSingleItem = null;
        if (singleDownloadBtn) {
            singleDownloadBtn.disabled = true;
            singleDownloadBtn.textContent = 'Add to Queue';
        }
    }

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
    const startQueueBtn = document.getElementById('start-queue-btn');
    const pauseQueueBtn = document.getElementById('pause-queue-btn');
    const pauseActiveBtn = document.getElementById('pause-active-btn');
    const resumeActiveBtn = document.getElementById('resume-active-btn');

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
    renderHistory();

    // --------------------------------------------------------
    // Globals
    // --------------------------------------------------------
    let ws = null;
    let activeFragments = {};
    let progressHistory = [];

    let currentChannelUrl = "";
    let currentPage = 1;
    let loadedVideos = [];
    let channelDefaultQuality = 'best';

    // Helpers
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

    const cancelActiveBtn = document.getElementById('cancel-active-btn');
    if (cancelActiveBtn) {
        cancelActiveBtn.onclick = () => {
            const url = cancelActiveBtn.getAttribute('data-url');
            if (url && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'cancel_download', url: url }));
                cancelActiveBtn.disabled = true;
                cancelActiveBtn.textContent = 'Cancelling...';
            }
        };
    }

    if (pauseActiveBtn) {
        pauseActiveBtn.onclick = () => {
            const url = pauseActiveBtn.getAttribute('data-url');
            if (url && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'pause_download', url: url }));
            }
        };
    }

    if (resumeActiveBtn) {
        resumeActiveBtn.onclick = () => {
            const url = resumeActiveBtn.getAttribute('data-url');
            if (url && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'resume_download', url: url }));
            }
        };
    }

    pendingList.addEventListener('click', (e) => {
        if (e.target.classList.contains('cancel-btn')) {
            const url = e.target.getAttribute('data-url');
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'cancel_download', url: url }));
            }
        }
    });

    function resetActiveStatus(msg = "Preparing download...", url = "") {
        statusContainer.classList.remove('hidden', 'success', 'error');
        progressFill.style.width = '0%';
        percentVal.textContent = '0%';
        speedVal.textContent = '0 MB/s';
        downloadedVal.textContent = '0 MB';
        etaVal.textContent = '--:--';
        videoInfo.textContent = msg;
        videoInfo.style.color = 'var(--text-main)';
        threadsContainer.style.display = 'none';
        threadsContainer.innerHTML = '';
        activeFragments = {};
        progressHistory = [];

        if (cancelActiveBtn) {
            cancelActiveBtn.style.display = url ? 'block' : 'none';
            cancelActiveBtn.disabled = false;
            cancelActiveBtn.textContent = 'Cancel';
            cancelActiveBtn.setAttribute('data-url', url);
        }
        if (pauseActiveBtn) {
            pauseActiveBtn.style.display = url ? 'block' : 'none';
            pauseActiveBtn.setAttribute('data-url', url);
        }
        if (resumeActiveBtn) {
            resumeActiveBtn.style.display = 'none';
            resumeActiveBtn.setAttribute('data-url', url);
        }
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
                <button class="cancel-btn" data-url="${item.url}" style="margin-left:8px; padding:2px 6px; font-size: 0.75rem; background:transparent; border:1px solid var(--error); color:var(--error); border-radius:4px; cursor:pointer;" title="Cancel">X</button>
            `;
            pendingList.appendChild(div);
        });
    }

    // --- WebSocket ---
    function connectWS() {
        if (ws) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

        ws.onmessage = (event) => {
            let data;
            try { data = JSON.parse(event.data); } catch (e) { return; }

            if (data.is_paused !== undefined) {
                if (data.is_paused) {
                    if (startQueueBtn) {
                        startQueueBtn.style.display = 'block';
                        startQueueBtn.textContent = 'Start Queue';
                    }
                    if (pauseQueueBtn) pauseQueueBtn.style.display = 'none';
                } else {
                    if (startQueueBtn) startQueueBtn.style.display = 'none';
                    if (pauseQueueBtn) pauseQueueBtn.style.display = 'block';
                }
            }

            if (data.status === 'state') {
                if (data.active) {
                    resetActiveStatus(`Downloading: ${data.active.title || data.active.url}`, data.active.url);
                }
                renderQueuePending(data.pending);
            }
            else if (data.status === 'queue_update') {
                renderQueuePending(data.pending);
            }
            else if (data.status === 'queue_started') {
                statusContainer.classList.remove('hidden');
                resetActiveStatus(`Downloading: ${data.item.title || data.item.url}`, data.item.url);
                if (data.pending) renderQueuePending(data.pending);
            }
            else if (data.status === 'downloading') {
                statusContainer.classList.remove('hidden');
                progressFill.style.width = `${data.percent}%`;
                percentVal.textContent = `${data.percent}%`;

                if (data.fragment_index) activeFragments[data.fragment_index] = Date.now();
                let now = Date.now();
                let activeKeys = Object.keys(activeFragments).filter(k => now - activeFragments[k] < 1500);

                if (activeKeys.length > 0) {
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

                let finalSpeed = data.speed > 0 ? data.speed : smoothedSpeed;
                speedVal.textContent = `${formatBytes(finalSpeed)}/s`;

                if (finalSpeed > 0 && data.total_bytes > 0) {
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
            } else if (data.status === 'download_paused') {
                if (pauseActiveBtn && resumeActiveBtn) {
                    pauseActiveBtn.style.display = 'none';
                    resumeActiveBtn.style.display = 'block';
                }
            } else if (data.status === 'download_resumed') {
                if (pauseActiveBtn && resumeActiveBtn) {
                    pauseActiveBtn.style.display = 'block';
                    resumeActiveBtn.style.display = 'none';
                }
            } else if (data.status === 'finished' || data.status === 'error') {
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

                downloadHistory.push({
                    title: finalTitle,
                    url: data.item ? data.item.url : '',
                    resolution: data.item ? data.item.resolution : '',
                    location: data.item ? data.item.location : '',
                    timestamp: Date.now()
                });
                if (downloadHistory.length > 50) downloadHistory.shift();
                localStorage.setItem('ytHistory', JSON.stringify(downloadHistory));
                renderHistory();
                if (typeof renderFullHistory === 'function') { renderFullHistory(); }

                setTimeout(() => {
                    if (statusContainer.classList.contains('success')) {
                        statusContainer.classList.add('hidden');
                    }
                }, 4000);
            }
            else if (data.status === 'error') {
                statusContainer.classList.add('error');

                if (data.message && data.message.includes('Download cancelled by user')) {
                    videoInfo.textContent = 'Download Cancelled';
                    videoInfo.style.color = 'var(--text-muted)';
                } else {
                    videoInfo.textContent = `Error: ${data.message}`;
                    videoInfo.style.color = 'var(--error)';
                }

                if (cancelActiveBtn) cancelActiveBtn.style.display = 'none';

                setTimeout(() => {
                    if (statusContainer.classList.contains('error')) {
                        statusContainer.classList.add('hidden');
                    }
                }, 4000);
            }
        };

        ws.onclose = () => { ws = null; setTimeout(connectWS, 3000); };
    }
    connectWS();

    // --- Directory Selection Common ---
    async function showFolderPicker() {
        try {
            const res = await fetch('/api/select-folder');
            const data = await res.json();
            if (data.path) return data.path;
            return null;
        } catch (err) {
            console.error("Failed to select folder:", err);
            return null;
        }
    }

    // --- Single Download Logic ---
    singleSearchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = urlInput.value.trim();
        if (!url) return;

        const btnText = searchBtn.querySelector('.btn-text');
        const loader = searchBtn.querySelector('.loader');

        btnText.style.display = 'none';
        loader.style.display = 'block';
        searchBtn.disabled = true;
        urlInput.disabled = true;
        singleVideoResult.style.display = 'none';
        currentSingleItem = null;

        try {
            const res = await fetch(`/api/channel/info?url=${encodeURIComponent(url)}&page=1`);
            const data = await res.json();

            if (data.status === 'success' && data.entries && data.entries.length > 0) {
                const vid = data.entries[0];
                currentSingleItem = vid;

                const thumbUrl = vid.thumbnail || ((vid.thumbnails && vid.thumbnails.length > 0) ? vid.thumbnails[vid.thumbnails.length - 1].url : '');
                singleThumb.style.opacity = '1';
                singleThumb.src = thumbUrl;
                singleTitle.textContent = vid.title || 'Untitled Video';
                singleDuration.textContent = formatDuration(vid.duration);
                singleVideoResult.style.display = 'block';

                if (globalLocationPath && globalLocationPath.value) {
                    singleDownloadBtn.disabled = false;
                } else {
                    singleDownloadBtn.disabled = true;
                }
                singleDownloadBtn.textContent = 'Add to Queue';
            } else {
                alert(`Error: ${data.message || 'No video found'}`);
            }
        } catch (err) {
            alert('Network error while searching.');
        } finally {
            btnText.style.display = 'block';
            loader.style.display = 'none';
            searchBtn.disabled = false;
            urlInput.disabled = false;
        }
    });

    const singleResBtns = document.querySelectorAll('#single-resolutions .res-btn');
    singleResBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            singleResBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    if (globalChooseFolderBtn) {
        globalChooseFolderBtn.addEventListener('click', async () => {
            const path = await showFolderPicker();
            if (path) {
                globalLocationPath.value = path;
                singleDownloadBtn.disabled = false;
                if (rememberLocationCb.checked) {
                    localStorage.setItem('ytLastLocation', path);
                }
            }
        });
    }

    if (rememberLocationCb) {
        rememberLocationCb.addEventListener('change', (e) => {
            if (e.target.checked && globalLocationPath.value) {
                localStorage.setItem('ytLastLocation', globalLocationPath.value);
            } else {
                localStorage.removeItem('ytLastLocation');
            }
        });
    }

    singleDownloadBtn.addEventListener('click', () => {
        if (!currentSingleItem || !ws || ws.readyState !== WebSocket.OPEN || !globalLocationPath.value) return;

        const activeResObj = document.querySelector('#single-resolutions .res-btn.active');
        const resolution = activeResObj ? activeResObj.getAttribute('data-res') : 'best';
        const location = globalLocationPath.value.trim();
        const threads = 1; // Defaulting to 1 for simplicity per new UI

        singleDownloadBtn.textContent = 'Adding...';
        singleDownloadBtn.disabled = true;

        ws.send(JSON.stringify({
            url: currentSingleItem.url,
            title: currentSingleItem.title,
            resolution: resolution,
            threads: threads,
            location: location
        }));

        setTimeout(() => {
            resetSingleForm();
        }, 1000);
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
                addChannelToHistory(currentChannelUrl, data.title || currentChannelUrl);
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

            const thumbUrl = vid.thumbnail || ((vid.thumbnails && vid.thumbnails.length > 0) ? vid.thumbnails[vid.thumbnails.length - 1].url : '');
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
                    <div class="resolution-buttons item-resolutions">
                        <button type="button" class="res-btn ${channelDefaultQuality === 'best' ? 'active' : ''}" data-res="best">Best Available</button>
                        <button type="button" class="res-btn ${channelDefaultQuality === '1080' ? 'active' : ''}" data-res="1080">1080p</button>
                        <button type="button" class="res-btn ${channelDefaultQuality === '720' ? 'active' : ''}" data-res="720">720p</button>
                        <button type="button" class="res-btn ${channelDefaultQuality === '480' ? 'active' : ''}" data-res="480">480p</button>
                        <button type="button" class="res-btn ${channelDefaultQuality === 'audio' ? 'active' : ''}" data-res="audio">Audio Only</button>
                    </div>
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
                    if (e.target.tagName !== 'INPUT' && !e.target.classList.contains('browse-playlist-btn') && !e.target.classList.contains('res-btn')) {
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

                // Handle resolution button clicks
                const resBtns = card.querySelectorAll('.res-btn');
                resBtns.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation(); // don't toggle select
                        resBtns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    });
                });
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

    channelQualitySelect.addEventListener('change', (e) => {
        channelDefaultQuality = e.target.value;
        const grids = videoGrid.querySelectorAll('.item-resolutions');
        grids.forEach(grp => {
            const btns = grp.querySelectorAll('.res-btn');
            btns.forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-res') === channelDefaultQuality);
            });
        });
    });

    queueSelectedBtn.addEventListener('click', () => {
        const checkboxes = videoGrid.querySelectorAll('.video-checkbox:checked');
        if (checkboxes.length === 0) return;

        checkboxes.forEach(cb => {
            const idx = cb.getAttribute('data-idx');
            const vid = loadedVideos[idx];
            const card = cb.closest('.video-card');
            const activeResBtn = card.querySelector('.res-btn.active');
            const res = activeResBtn ? activeResBtn.getAttribute('data-res') : 'best';

            if (vid && vid.url && ws && ws.readyState === WebSocket.OPEN) {
                // Not setting location here; let backend default to empty temporarily
                ws.send(JSON.stringify({
                    url: vid.url,
                    title: vid.title,
                    resolution: res,
                    threads: 1, // Defaulting to 1 to simplify UI
                    location: ""
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

    // --- Queue Controls ---
    if (startQueueBtn) {
        startQueueBtn.addEventListener('click', () => {
            if (!globalLocationPath.value) {
                alert("Please select a download folder first.");
                return;
            }
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'start_queue', location: globalLocationPath.value }));
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

    // --------------------------------------------------------
    // Full History Logic
    // --------------------------------------------------------
    const historyFullList = document.getElementById('history-full-list');
    const historySearchInput = document.getElementById('history-search-input');

    window.renderFullHistory = function (searchTerm = '') {
        if (!historyFullList) return;
        historyFullList.innerHTML = '';

        let filtered = downloadHistory;
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            filtered = downloadHistory.filter(item =>
                (item.title && item.title.toLowerCase().includes(lowerTerm)) ||
                (item.url && item.url.toLowerCase().includes(lowerTerm))
            );
        }

        if (filtered.length === 0) {
            historyFullList.innerHTML = '<div class="empty-queue">No history.</div>';
            return;
        }

        // We want reverse chronological order
        [...filtered].reverse().forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-item-thumb">
                    <!-- Thumbnail logic if available in the future. For now, empty fallback -->
                </div>
                <div class="history-item-info">
                    <div class="history-item-title">${item.title || item.url}</div>
                    <div class="history-item-meta">
                        <span>Res: ${item.resolution || 'N/A'}</span>
                        <span>|</span>
                        <span>Date: ${item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'}</span>
                    </div>
                    ${item.url ? '<div class="history-item-meta" style="font-size:0.75rem; word-break: break-all;">' + item.url + '</div>' : ''}
                </div>
            `;
            historyFullList.appendChild(div);
        });
    };

    if (historySearchInput) {
        historySearchInput.addEventListener('input', (e) => {
            window.renderFullHistory(e.target.value.trim());
        });
    }

    // Initialize layout
    switchTab('single');
});
