chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("Sender tab: ", sender.tab);
    if(request.message === "updateBackgroundImage") {
        console.log("Received message to update background image");
        document.body.style.backgroundImage = request.data;
        sendResponse({message: "Received message to update background image"});
    }
});