// This threshold is used to determine if the tabnabbing attack is detected
// The paper suggests that 5% is a good enough threshold for 78% sites and 40% for 97% sites
// But from our experiments, I found that using resemblejs, 5% is also too high to detect changes in the tab
// So I have set it to 1% for now, ideally it should be decided based on more data points
const THRESHOLD_DIFF_PERCENTAGE = 1;
let tabPercentage = 0;

function onCompletePromisify(data) {
    if (!data) {
        return Promise.reject(new Error('No data'));
    }
    return new Promise((resolve, reject) => {
        data.onComplete((data) => {
            resolve(data);
        });
    });
};

async function getDiffV2(image1, image2) {
    // Update resemblejs output options
    resemble.outputSettings({
        errorColor: {
            red: 255,
            green: 0,
            blue: 0,
        },
        errorType: "movement",
        transparency: 0.3,
        largeImageThreshold: 1200,
        useCrossOrigin: false,
        outputDiff: true
    });

    const data = await onCompletePromisify(resemble(image1).compareTo(image2));
    return data;
}

// Display the diff to the user
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
}

async function checkForDiff(data) {
    let iconData = {
        message: "showSuccessIcon",
    }
    tabPercentage = data.misMatchPercentage;
    if(data.misMatchPercentage > THRESHOLD_DIFF_PERCENTAGE) { // Tabnabbing detected
        // Set the background image
        setBackgroundImage(data.getImageDataUrl());
        
        // Update the extension icon
        iconData = {
            message: "showErrorIcon",
        }
    }
    chrome.runtime.sendMessage(iconData);
}

// Event listener to add diff image to webpage
chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    if(request.message === "updateImage") {
        const image1 = request.data.image1;
        const image2 = request.data.image2;
        const data = await getDiffV2(image1, image2);
        if (data === "No data") {
            console.log("Error getting diff data");
            sendResponse({ message: "error in updating image" });
            return;
        } else {
            await checkForDiff(data);
            sendResponse({ message: "Updated Image: success"});
        }
    } else if (request.message === "getDiffPercentage") {
        sendResponse({ percentage: tabPercentage });
    }
});
