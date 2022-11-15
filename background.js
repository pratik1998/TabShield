let previousTabId = -1;
let previousWindowId = -1;
let currentTabId = -1;
let currentWindowId = -1;

// Map of tabId to the file path of last screenshot of the tab
const tabIDToScreenshot = new Map();

async function getCurrentTab() {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

async function takeScreenshot() {
    let dataUrl = await takeCurrentTabScreenshot();
    tabIDToScreenshot.set(currentTabId, dataUrl);
}

async function takeCurrentTabScreenshot() {
    if (currentTabId !== -1 && currentWindowId !== -1) {
        console.log('Taking screenshot of tab: ', currentTabId, 'and window:', currentWindowId);
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(currentWindowId, { format: "png" });
            return dataUrl;
        } catch (error) {
            console.log('Error while taking screenshot: ', error.message);
            if(error.message === "This request exceeds the MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota.") {
                // Wait for 1 second to reset the quota
                setTimeout(async () => {
                    return await takeCurrentTabScreenshot();
                }, 1000);
            }
        }
    }
}

async function monitorTabs() {
    setInterval(async () => {
        await takeScreenshot();
    }, 10 * 1000);
}

async function init() {
    const tab = await getCurrentTab();
    currentTabId = tab.id;
    currentWindowId = tab.windowId;
    monitorTabs();
}

// Display diff image to user
function setBackgroundImage(imgData) {
    var backgroundImgEle = document.createElement('div');
    backgroundImgEle.id = "backgroundImgEle";
    backgroundImgEle.style.width = "100%";
    backgroundImgEle.style.height = "100%";
    backgroundImgEle.style.top = "0px";
    backgroundImgEle.style.left = "0px";
    backgroundImgEle.style.backgroundImage = "url(" + imgData + ")";
    backgroundImgEle.style.backgroundSize = "100% 100%"
    backgroundImgEle.style.position = "fixed";
    backgroundImgEle.addEventListener("click", function() {
        // Remove the background image
        var temp = document.getElementById('backgroundImgEle')
            temp.parentNode.removeChild(temp);
    });
    document.body.appendChild(backgroundImgEle);
}

async function updateTabInfo(activeInfo) {
    previousTabId = currentTabId;
    currentTabId = activeInfo.tabId;
    currentWindowId = activeInfo.windowId;
    const latestScreenshot = await takeCurrentTabScreenshot();
    const previousScreenshot = tabIDToScreenshot.get(currentTabId);

    // Means that the tab has been visited first time
    if(!previousScreenshot) {
        console.log("No previous screenshot found");
        tabIDToScreenshot.set(currentTabId, latestScreenshot);
        return;
    }

    // Check for change in tab for tabnabbing attack
    const updateBackgroundImageMsg = {
        id: currentTabId,
        message: "updateImage",
        data: {
            "image1": latestScreenshot,
            "image2": previousScreenshot
        }
    };

    chrome.tabs.sendMessage(currentTabId, updateBackgroundImageMsg);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("In Background Received message: ", request);
    console.log(sender.tab ?
        "from a content script:" + sender.tab :
        "from the extension");
    // Update the extension icon
    if(request.message === "showErrorIcon") {
        const iconData = {
            tabId: currentTabId,
            path: "icons/icons8-shield-64-red.png"
        };
        chrome.action.setIcon(iconData);
    } else if (request.message === "showSuccessIcon") {
        const iconData = {
            tabId: currentTabId,
            path: "icons/icons8-shield-64.png"
        };
        chrome.action.setIcon(iconData);
    }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    // Adding a delay to avoid "Tabs cannot be edited right now (user may be dragging a tab)" error
    setTimeout(() => {
        updateTabInfo(activeInfo);
    }, 200);
});

// Removing tab from the map when the tab is closed
// This is to avoid memory leak and memory exhaustion
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (tabIDToScreenshot.has(tabId)) {
        console.log("Tab screenshot removed: ", tabId);
        tabIDToScreenshot.delete(tabId);
    }
});

init();
