const loginPage =
    document.getElementById("loginPage");

const dashboard =
    document.getElementById("dashboard");

const loginForm =
    document.getElementById("loginForm");

const loginError =
    document.getElementById("loginError");

const messagesList =
    document.getElementById("messagesList");

const statusFilter =
    document.getElementById("statusFilter");

const messageModal =
    document.getElementById("messageModal");

const modalClose =
    document.getElementById("modalClose");

const logoutButton =
    document.getElementById("logoutButton");

const refreshButton =
    document.getElementById("refreshButton");

const adminUsername =
    document.getElementById("adminUsername");

let messages = [];

let selectedMessage = null;


/* =========================================================
   API HELPER
========================================================= */

async function api(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                credentials: "include",
                ...options,

                headers: {
                    "Content-Type":
                        "application/json",

                    ...(options.headers || {})
                }
            }
        );


    if (
        response.status === 401
    ) {

        showLogin();

        throw new Error(
            "Session expired"
        );

    }


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.message ||
            "Request failed"
        );

    }


    return data;

}


/* =========================================================
   CHECK AUTH
========================================================= */

async function checkAuth() {

    try {

        const data =
            await api("/api/auth/me");

        adminUsername.textContent =
            data.user.username;

        showDashboard();

        await loadDashboard();

    } catch {

        showLogin();

    }

}


/* =========================================================
   LOGIN
========================================================= */

loginForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const username =
            document.getElementById(
                "username"
            ).value.trim();


        const password =
            document.getElementById(
                "password"
            ).value;


        loginError.textContent =
            "";


        const button =
            loginForm.querySelector(
                "button"
            );


        button.disabled = true;


        try {

            const data =
                await api(
                    "/api/auth/login",
                    {
                        method: "POST",

                        body:
                            JSON.stringify({
                                username,
                                password
                            })
                    }
                );


            if (data.success) {

                const me =
                    await api(
                        "/api/auth/me"
                    );


                adminUsername.textContent =
                    me.user.username;


                showDashboard();

                await loadDashboard();

            }


        } catch (error) {

            loginError.textContent =
                error.message;

        } finally {

            button.disabled = false;

        }

    }
);


/* =========================================================
   SHOW LOGIN
========================================================= */

function showLogin() {

    loginPage.style.display =
        "grid";

    dashboard.classList.remove(
        "visible"
    );

}


/* =========================================================
   SHOW DASHBOARD
========================================================= */

function showDashboard() {

    loginPage.style.display =
        "none";

    dashboard.classList.add(
        "visible"
    );

}


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadDashboard() {

    await Promise.all([
        loadStats(),
        loadMessages(),
        loadVisitorStats()
    ]);

}

/* =========================================================
   LOAD STATS
========================================================= */

async function loadStats() {

    try {

        const data =
            await api(
                "/api/admin/stats"
            );


        document.getElementById(
            "totalMessages"
        ).textContent =
            data.stats.total;


        document.getElementById(
            "unreadMessages"
        ).textContent =
            data.stats.unread;


        document.getElementById(
            "readMessages"
        ).textContent =
            data.stats.read;


        document.getElementById(
            "repliedMessages"
        ).textContent =
            data.stats.replied;


    } catch (error) {

        console.error(error);

    }

}

/* =========================================================
   LOAD VISITOR STATISTICS
========================================================= */

async function loadVisitorStats() {

    try {

        const data =
            await api(
                "/api/admin/visitor-stats"
            );


        const stats =
            data.stats;


        document.getElementById(
            "totalVisits"
        ).textContent =
            formatNumber(
                stats.totalVisits
            );


        document.getElementById(
            "uniqueVisitors"
        ).textContent =
            formatNumber(
                stats.uniqueVisitors
            );


        document.getElementById(
            "todayVisits"
        ).textContent =
            formatNumber(
                stats.todayVisits
            );


        document.getElementById(
            "yesterdayVisits"
        ).textContent =
            formatNumber(
                stats.yesterdayVisits
            );


        document.getElementById(
            "monthVisits"
        ).textContent =
            formatNumber(
                stats.monthVisits
            );


        renderAnalyticsList(
            "deviceStats",
            stats.devices
        );


        renderAnalyticsList(
            "browserStats",
            stats.browsers
        );


        renderDailyStats(
            stats.daily
        );


        document.getElementById(
            "analyticsStatus"
        ).textContent =
            "Live";


    } catch (error) {

        console.error(
            "Visitor analytics:",
            error
        );


        document.getElementById(
            "analyticsStatus"
        ).textContent =
            "Unavailable";

    }

}


/* =========================================================
   FORMAT NUMBER
========================================================= */

function formatNumber(number) {

    return Number(
        number || 0
    ).toLocaleString();

}


/* =========================================================
   ANALYTICS LIST
========================================================= */

function renderAnalyticsList(
    elementId,
    data
) {

    const element =
        document.getElementById(
            elementId
        );


    if (!data) {

        element.textContent =
            "No data";

        return;

    }


    const entries =
        Object.entries(data)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            );


    if (!entries.length) {

        element.innerHTML = `
            <span style="color:var(--muted)">
                No data yet
            </span>
        `;

        return;

    }


    element.innerHTML =
        entries
            .map(
                ([name, count]) => `
                    <div class="analytics-item">

                        <span>
                            ${escapeHtml(name)}
                        </span>

                        <strong>
                            ${formatNumber(count)}
                        </strong>

                    </div>
                `
            )
            .join("");

}


/* =========================================================
   DAILY STATS
========================================================= */

function renderDailyStats(
    daily
) {

    const element =
        document.getElementById(
            "dailyStats"
        );


    if (!daily || !daily.length) {

        element.innerHTML = `
            <span style="color:var(--muted)">
                No data yet
            </span>
        `;

        return;

    }


    element.innerHTML =
        daily
            .map(item => {

                const date =
                    new Date(
                        item.date +
                        "T00:00:00"
                    );


                const day =
                    date.toLocaleDateString(
                        undefined,
                        {
                            weekday: "short"
                        }
                    );


                return `
                    <div class="daily-item">

                        <span class="day">
                            ${day}
                        </span>

                        <strong>
                            ${formatNumber(
                                item.visits
                            )}
                        </strong>

                    </div>
                `;

            })
            .join("");

}
/* =========================================================
   LOAD MESSAGES
========================================================= */

async function loadMessages() {

    messagesList.innerHTML = `
        <div class="loading">
            <i class="fa-solid fa-spinner fa-spin"></i>
            Loading messages...
        </div>
    `;


    try {

        const data =
            await api(
                "/api/admin/messages"
            );


        messages =
            data.messages;


        renderMessages();


    } catch (error) {

        messagesList.innerHTML = `
            <div class="empty">
                ${escapeHtml(error.message)}
            </div>
        `;

    }

}


/* =========================================================
   RENDER MESSAGES
========================================================= */

function renderMessages() {

    const filter =
        statusFilter.value;


    let filtered =
        messages;


    if (filter !== "all") {

        filtered =
            messages.filter(
                message =>
                    message.status === filter
            );

    }


    if (!filtered.length) {

        messagesList.innerHTML = `
            <div class="empty">
                <div>
                    <i class="fa-regular fa-envelope"
                       style="font-size:30px">
                    </i>

                    <p>No messages found.</p>
                </div>
            </div>
        `;

        return;

    }


    messagesList.innerHTML =
        filtered
            .map(
                message =>
                    createMessageHTML(
                        message
                    )
            )
            .join("");


    document
        .querySelectorAll(".message-row")
        .forEach(row => {

            row.addEventListener(
                "click",
                () => {

                    const id =
                        row.dataset.id;

                    openMessage(id);

                }
            );

        });

}


/* =========================================================
   MESSAGE HTML
========================================================= */

function createMessageHTML(
    message
) {

    const date =
        formatDate(
            message.createdAt
        );


    return `
        <div
            class="message-row ${message.status}"
            data-id="${message._id}"
        >

            <div class="avatar">

                <i class="fa-regular fa-user"></i>

            </div>


            <div class="message-main">

                <h3>
                    ${escapeHtml(message.name)}
                </h3>

                <p>
                    <strong>
                        ${escapeHtml(message.subject)}
                    </strong>
                    ·
                    ${escapeHtml(message.message)}
                </p>

            </div>


            <span class="status ${message.status}">
                ${message.status}
            </span>


            <time class="message-date">
                ${date}
            </time>

        </div>
    `;

}


/* =========================================================
   OPEN MESSAGE
========================================================= */

async function openMessage(id) {

    try {

        const data =
            await api(
                `/api/admin/messages/${id}`
            );


        selectedMessage =
            data.message;


        document.getElementById(
            "modalName"
        ).textContent =
            selectedMessage.name;


        const email =
            document.getElementById(
                "modalEmail"
            );


        email.textContent =
            selectedMessage.email;


        email.href =
            `mailto:${selectedMessage.email}`;


        document.getElementById(
            "modalStatus"
        ).textContent =
            selectedMessage.status;


        document.getElementById(
            "modalDate"
        ).textContent =
            formatDate(
                selectedMessage.createdAt
            );


        document.getElementById(
            "modalSubject"
        ).textContent =
            selectedMessage.subject;


        document.getElementById(
            "modalMessage"
        ).textContent =
            selectedMessage.message;


        document.getElementById(
            "replyButton"
        ).href =
            `mailto:${encodeURIComponent(
                selectedMessage.email
            )}?subject=${encodeURIComponent(
                "Re: " +
                selectedMessage.subject
            )}`;


        messageModal.classList.add(
            "open"
        );


        /*
         * Automatically mark unread
         * messages as read.
         */

        if (
            selectedMessage.status ===
            "unread"
        ) {

            await updateStatus(
                selectedMessage._id,
                "read",
                false
            );

        }


    } catch (error) {

        alert(error.message);

    }

}


/* =========================================================
   UPDATE STATUS
========================================================= */

async function updateStatus(
    id,
    status,
    reload = true
) {

    try {

        await api(
            `/api/admin/messages/${id}/status`,
            {
                method: "PATCH",

                body:
                    JSON.stringify({
                        status
                    })
            }
        );


        if (reload) {

            await loadDashboard();

        }

    } catch (error) {

        alert(error.message);

    }

}


/* =========================================================
   MARK REPLIED
========================================================= */

document
    .getElementById(
        "markRepliedButton"
    )
    .addEventListener(
        "click",
        async () => {

            if (!selectedMessage) {
                return;
            }


            await updateStatus(
                selectedMessage._id,
                "replied"
            );


            closeModal();

        }
    );


/* =========================================================
   DELETE
========================================================= */

document
    .getElementById(
        "deleteMessageButton"
    )
    .addEventListener(
        "click",
        async () => {

            if (!selectedMessage) {
                return;
            }


            const confirmed =
                confirm(
                    "Delete this message permanently?"
                );


            if (!confirmed) {
                return;
            }


            try {

                await api(
                    `/api/admin/messages/${selectedMessage._id}`,
                    {
                        method: "DELETE"
                    }
                );


                closeModal();

                await loadDashboard();


            } catch (error) {

                alert(error.message);

            }

        }
    );


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeModal() {

    messageModal.classList.remove(
        "open"
    );

    selectedMessage = null;

}


modalClose.addEventListener(
    "click",
    closeModal
);


messageModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            messageModal
        ) {
            closeModal();
        }

    }
);


/* =========================================================
   FILTER
========================================================= */

statusFilter.addEventListener(
    "change",
    renderMessages
);


/* =========================================================
   REFRESH
========================================================= */

refreshButton.addEventListener(
    "click",
    loadDashboard
);


/* =========================================================
   LOGOUT
========================================================= */

logoutButton.addEventListener(
    "click",
    async () => {

        try {

            await api(
                "/api/auth/logout",
                {
                    method: "POST"
                }
            );

        } catch (error) {

            console.error(error);

        }


        showLogin();

    }
);


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(date) {

    return new Date(date)
        .toLocaleString(
            undefined,
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value ?? "";

    return div.innerHTML;

}

/* =========================================================
   VISITOR ANALYTICS
========================================================= */

async function trackVisit() {

    try {

        await fetch(
            "/api/visit",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    path:
                        window.location.pathname +
                        window.location.search
                }),
                keepalive: true
            });

    } catch (error) {

        /*
         * Analytics errors should never
         * affect the website.
         */
        console.debug(
            "Analytics unavailable"
        );

    }

}


trackVisit();
/* =========================================================
   START
========================================================= */

checkAuth();