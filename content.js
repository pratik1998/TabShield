// This threshold is used to determine if the tabnabbing attack is detected
// The paper suggests that 0.05 is a good enough threshold for 78% sites and 0.4 for 97% sites
// We are using 0.15 as a threshold for now
const THRESHOLD_DIFF_PERCENTAGE = 0.15;

function onCompletePromisify(data) {
    return new Promise((resolve, reject) => {
        data.onComplete((data) => {
            resolve(data);
        });
    });
};

async function getDiffV2(image1, image2) {
    const data = await onCompletePromisify(resemble(image1).compareTo(image2));
    console.log("On Complete Data:", data);
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

function changePercentage(percentage) {
    let color = 'green';
    if (percentage > 50)
        color = 'red';
    else if (percentage > 15)
        color = 'orange';
    document.getElementById("percentage-circle").className = `c100 p${percentage} small ${color}`;
    document.getElementById("percentage-value").textContent = `${percentage}%`;
    console.log("Percentage:", `c100 p${percentage} small ${color}`, `${percentage}%`);
}

async function checkForDiff(data) {
    let iconData = {
        message: "showSuccessIcon",
    }
    if(data.misMatchPercentage > THRESHOLD_DIFF_PERCENTAGE) {
        console.log("Tabnabbing attack detected");
        // Set the background image
        setBackgroundImage(data.getImageDataUrl());
        
        // Update the extension icon
        iconData = {
            message: "showErrorIcon",
        }
    }
    chrome.runtime.sendMessage(iconData);
    // chrome.storage.sync.set({ "diffPercentage": data.misMatchPercentage });
    // console.log("Diff Percentage:", data.misMatchPercentage);
    // chrome.storage.sync.get("diffPercentage", (data) => {
    //     console.log("Stored Diff Percentage:", data);
    // });
    var port = chrome.runtime.connect({name: "popup"});
    port.postMessage({ message: "updatePercentage", percentage: data.misMatchPercentage });
}

// Event listener to add diff image to webpage
chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    console.log('Sender Tab:', sender);
    console.log('Request:', request);
    if(request.message == "updateImage") {
        const image1 = request.data.image1;
        const image2 = request.data.image2;
        const data = await getDiffV2(image1, image2);
        console.log("Diff Data:", data);
        await checkForDiff(data);
        sendResponse({ message: "Updated Image: success"});
    }
});