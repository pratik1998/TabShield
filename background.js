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
    if(!dataUrl) {
        console.log("No screenshot taken :("); // Mainly because of the limitation of chrome API
        return;
    }
    tabIDToScreenshot.set(currentTabId, dataUrl);
}

// Please note that this function has limitation that if MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND is exceeded
// then it will not be able to take screenshot of the tab
// The limitation is imposed by chrome API and can not be avoided because if we try to delay the call then
// the tab will be switched and we will not be able to take screenshot of the tab and that will be a problem
// as we need to store screenshot with tabId
// https://developer.chrome.com/extensions/tabs#method-captureVisibleTab
async function takeCurrentTabScreenshot() {
    if (currentTabId !== -1 && currentWindowId !== -1) {
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(currentWindowId, { format: "png" });
            return dataUrl;
        } catch (error) {
            // This error can be thrown if
            // 1. The tab is not visible (e.g. extension tab, devtools tab or tab with empty URL)
            // 2. MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota is exceeded
            return;
        }
    }
}

// Monitor tab changes and take screenshot of the tab periodically
// Deciding the frequency of taking screenshot is a tradeoff between accuracy and correctness
async function monitorTabs() {
    setInterval(async () => {
        await takeScreenshot();
    }, 3 * 1000);
}

async function init() {
    const tab = await getCurrentTab();
    currentTabId = tab.id;
    currentWindowId = tab.windowId;
    monitorTabs();
}

async function updateTabInfo(activeInfo) {
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

    if(!latestScreenshot) {
        console.log("No latest screenshot taken:(");
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

    try {
        chrome.tabs.sendMessage(currentTabId, updateBackgroundImageMsg);
    } catch (error) {
        console.log('Error while sending message to tab: ', error.message);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
        tabIDToScreenshot.delete(tabId);
    }
});

init();
