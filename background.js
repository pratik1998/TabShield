// import './node_modules/resemblejs/resemble.js';

let previousTabId = -1;
let previousWindowId = -1;
let currentTabId = -1;
let currentWindowId = -1;

// This threshold is used to determine if the tabnabbing attack is detected
// The paper suggests that 0.05 is a good enough threshold for 78% sites and 0.4 for 97% sites
// We are using 0.15 as a threshold for now
const THRESHOLD_DIFF_PERCENTAGE = 0.15;

// var resemblejs = require('resemblejs');

// Map of tabId to the file path of last screenshot of the tab
const tabIDToScreenshot = new Map();

async function getDiff(image1, image2) {
    const options = {
        output: {
            errorColor: {
                red: 255,
                green: 0,
                blue: 255
            },
            errorType: "movement",
            transparency: 0.3,
            largeImageThreshold: 1200,
            useCrossOrigin: false,
            outputDiff: true
        },
        scaleToSameSize: true,
        ignore: "antialiasing"
    };

    const data = await resemblejs.compareImages(image1, image2, options);
    // console.log('Diff: ', data);
}

async function getCurrentTab() {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

async function takeScreenshot() {
    // const tab = await getCurrentTab();
    // if (tab && tab.id) {
    //     console.log('Taking screenshot of tab: ', tab.id, 'and window:', tab.windowId);
    //     await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, (dataUrl) => {
    //         // Save the screenshot to the map
    //         // const screenshot = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");
    //         // const filePath = `./screenshots/${tab.id}.png`;
    //         // const data = new Blob([screenshot], { type: "image/png" });
    //         tabIDToScreenshot.set(tab.id, dataUrl);
    //     });
    // }
    let dataUrl = await takeScreenshotV2();
    tabIDToScreenshot.set(currentTabId, dataUrl);
}

async function takeScreenshotV2() {
    // const tab = await getCurrentTab();
    if (currentTabId !== -1 && currentWindowId !== -1) {
        console.log('Taking screenshot of tab: ', currentTabId, 'and window:', currentWindowId);
        const dataUrl = await chrome.tabs.captureVisibleTab(currentWindowId, { format: "png" });
        return dataUrl;
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

// Generate the diff image
async function getImageDiff(image1, image2) {
    console.log(image1);
    console.log(image2);
    const response = await fetch('http://localhost:8081/getDiff', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ "image1": image1, "image2": image2 })
    });
    const data = await response.json();
    return data;
}

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
    const latestScreenshot = await takeScreenshotV2();
    console.log("Latest Screenshot:", latestScreenshot);
    const previousScreenshot = tabIDToScreenshot.get(currentTabId);

    // Means that the tab has been visited first time
    if(!previousScreenshot) {
        console.log("No previous screenshot found");
        tabIDToScreenshot.set(currentTabId, latestScreenshot);
        return;
    }

    // Check for change in tab for tabnabbing attack
    const imageDiffData = await getImageDiff(latestScreenshot, previousScreenshot);
    console.log("Image Diff Data: ", imageDiffData);

    if(imageDiffData.diffPercentage > THRESHOLD_DIFF_PERCENTAGE) {
        console.log("Tabnabbing attack detected");
        // Set the background image
        chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            function: setBackgroundImage,
            args: [imageDiffData.diff]
        });

        // Update the extension icon
        const iconData = {
            tabId: currentTabId,
            path: "icons/icons8-shield-64-red.png"
        };
        chrome.action.setIcon(iconData);

    } else {
        console.log("No significant change detected!");
        // Update the extension icon
        const iconData = {
            tabId: currentTabId,
            path: "icons/icons8-shield-64.png"
        };
        chrome.action.setIcon(iconData);
    }

    // const updateBackgroundImageMsg = {
    //     message: "updateBackgroundImage",
    //     data: imageDiffData
    // };

    // chrome.tabs.sendMessage(currentTabId, updateBackgroundImageMsg, function(response) {
    //     console.log(response.message);
    // });
}

init();

chrome.tabs.onActivated.addListener((activeInfo) => {
    // Adding a delay to avoid "Tabs cannot be edited right now (user may be dragging a tab)" error
    setTimeout(() => {
        updateTabInfo(activeInfo);
    }, 200);
});
