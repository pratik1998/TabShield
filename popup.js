async function getCurrentTab() {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

// Shows the diff percentage in the popup
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
}

async function getDiffPercentage() {
    const tab = await getCurrentTab();
    chrome.tabs.sendMessage(tab.id, { message: "getDiffPercentage" }, (response) => {
        changePercentage(response.percentage);
    });
}

getDiffPercentage();