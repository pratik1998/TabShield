function changePercentage(percentage) {
    if (!percentage) {
        percentage = 0;
    }
    percentage = parseInt(percentage);
    let color = 'green';
    if (percentage > 50)
        color = 'red';
    else if (percentage > 15)
        color = 'orange';
    document.getElementById("percentage-circle").className = `c100 p${percentage} small ${color}`;
    document.getElementById("percentage-value").textContent = `${percentage}%`;
    console.log("Percentage:", `c100 p${percentage} small ${color}`, `${percentage}%`);
}

chrome.runtime.onConnect.addListener(function(port) {
    port.onMessage.addListener(function(msg) {
        console.log("Message received in popup.js:", msg);
    });
});