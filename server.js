require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Datastore = require("nedb-promises");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in .env");
}


/* =========================================================
   TRUST NGINX PROXY
========================================================= */

app.set("trust proxy", 1);


/* =========================================================
   DATABASE
========================================================= */

const usersDB = Datastore.create({
    filename: path.join(__dirname, "database", "users.db"),
    autoload: true
});

const messagesDB = Datastore.create({
    filename: path.join(__dirname, "database", "messages.db"),
    autoload: true
});

const visitorsDB = Datastore.create({
    filename: path.join(__dirname, "database", "visitors.db"),
    autoload: true
});

const visitsDB = Datastore.create({
    filename: path.join(__dirname, "database", "visits.db"),
    autoload: true
});


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(cookieParser());

app.use(express.static(
    path.join(__dirname, "public")
));


/* =========================================================
   HELPERS
========================================================= */

function createToken(user) {

    return jwt.sign(
        {
            id: user._id,
            username: user.username,
            role: user.role
        },
        JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );

}


function authMiddleware(req, res, next) {

    const token = req.cookies.admin_token;

    if (!token) {

        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });

    }

    try {

        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {

        res.clearCookie("admin_token");

        return res.status(401).json({
            success: false,
            message: "Invalid or expired session"
        });

    }

}


/* =========================================================
   ANALYTICS HELPERS
========================================================= */

function generateVisitorId() {

    return crypto.randomUUID();

}


function hashIP(ip) {

    return crypto
        .createHash("sha256")
        .update(
            `${ip}:${JWT_SECRET}`
        )
        .digest("hex");

}


function getClientIP(req) {

    return (
        req.ip ||
        req.socket.remoteAddress ||
        "unknown"
    );

}


function getDateKey(date = new Date()) {

    return date
        .toISOString()
        .slice(0, 10);

}


function getMonthKey(date = new Date()) {

    return date
        .toISOString()
        .slice(0, 7);

}


function getYesterdayKey() {

    const date = new Date();

    date.setUTCDate(
        date.getUTCDate() - 1
    );

    return getDateKey(date);

}


function getDevice(userAgent = "") {

    const ua =
        userAgent.toLowerCase();


    if (
        /mobile|android|iphone|ipad|ipod/i.test(ua)
    ) {

        return "Mobile";

    }


    if (
        /tablet/i.test(ua)
    ) {

        return "Tablet";

    }


    return "Desktop";

}


function getBrowser(userAgent = "") {

    if (/edg/i.test(userAgent)) {
        return "Edge";
    }

    if (/chrome/i.test(userAgent)) {
        return "Chrome";
    }

    if (/firefox/i.test(userAgent)) {
        return "Firefox";
    }

    if (/safari/i.test(userAgent)) {
        return "Safari";
    }

    if (/opera|opr/i.test(userAgent)) {
        return "Opera";
    }

    return "Other";

}


/* =========================================================
   CREATE ADMIN
========================================================= */

async function createAdmin() {

    const existingAdmin =
        await usersDB.findOne({
            username: process.env.ADMIN_USERNAME
        });

    if (existingAdmin) {
        return;
    }


    const passwordHash =
        await bcrypt.hash(
            process.env.ADMIN_PASSWORD,
            12
        );


    await usersDB.insert({

        username:
            process.env.ADMIN_USERNAME,

        password:
            passwordHash,

        role:
            "admin",

        createdAt:
            new Date()

    });


    console.log(
        `Admin created: ${process.env.ADMIN_USERNAME}`
    );

}


/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
    "/api/auth/login",
    async (req, res) => {

        try {

            const {
                username,
                password
            } = req.body;


            if (
                !username ||
                !password
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Username and password are required"
                });

            }


            const user =
                await usersDB.findOne({
                    username
                });


            if (!user) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid credentials"
                });

            }


            const validPassword =
                await bcrypt.compare(
                    password,
                    user.password
                );


            if (!validPassword) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid credentials"
                });

            }


            const token =
                createToken(user);


            res.cookie(
                "admin_token",
                token,
                {
                    httpOnly: true,

                    secure:
                        process.env.NODE_ENV ===
                        "production",

                    sameSite: "lax",

                    maxAge:
                        7 *
                        24 *
                        60 *
                        60 *
                        1000,

                    path: "/"
                }
            );


            res.json({
                success: true,
                message:
                    "Login successful"
            });


        } catch (error) {

            console.error(error);


            res.status(500).json({
                success: false,
                message:
                    "Login failed"
            });

        }

    }
);


/* =========================================================
   LOGOUT
========================================================= */

app.post(
    "/api/auth/logout",
    authMiddleware,
    (req, res) => {

        res.clearCookie(
            "admin_token",
            {
                httpOnly: true,
                sameSite: "lax",
                secure:
                    process.env.NODE_ENV ===
                    "production",
                path: "/"
            }
        );


        res.json({
            success: true,
            message:
                "Logged out"
        });

    }
);


/* =========================================================
   CURRENT ADMIN
========================================================= */

app.get(
    "/api/auth/me",
    authMiddleware,
    (req, res) => {

        res.json({

            success: true,

            user: {
                id:
                    req.user.id,

                username:
                    req.user.username,

                role:
                    req.user.role
            }

        });

    }
);


/* =========================================================
   PUBLIC VISITOR TRACKING
========================================================= */

app.post(
    "/api/visit",
    async (req, res) => {

        try {

            let visitorId =
                req.cookies.vimate_visitor;


            let isNewVisitor =
                false;


            /*
             * Create anonymous visitor ID
             */

            if (!visitorId) {

                visitorId =
                    generateVisitorId();

                isNewVisitor =
                    true;


                res.cookie(
                    "vimate_visitor",
                    visitorId,
                    {
                        httpOnly: true,

                        secure:
                            process.env.NODE_ENV ===
                            "production",

                        sameSite: "lax",

                        maxAge:
                            365 *
                            24 *
                            60 *
                            60 *
                            1000,

                        path: "/"
                    }
                );

            }


            const now =
                new Date();


            const dateKey =
                getDateKey(now);


            const monthKey =
                getMonthKey(now);


            const ip =
                getClientIP(req);


            const ipHash =
                hashIP(ip);


            const userAgent =
                req.get("user-agent") ||
                "";


            const device =
                getDevice(userAgent);


            const browser =
                getBrowser(userAgent);


            const pathVisited =
                typeof req.body.path ===
                "string"
                    ? req.body.path.slice(0, 500)
                    : "/";


            const referrer =
                req.get("referer") ||
                "";


            /*
             * Make sure visitor exists.
             */

            const existingVisitor =
                await visitorsDB.findOne({
                    visitorId
                });


            if (!existingVisitor) {

                await visitorsDB.insert({

                    visitorId,

                    ipHash,

                    firstVisit:
                        now,

                    lastVisit:
                        now,

                    visits: 0

                });

                isNewVisitor =
                    true;

            }


            /*
             * Check whether this is a
             * new session.
             */

            const lastVisit =
                existingVisitor
                    ? new Date(
                        existingVisitor.lastVisit
                    )
                    : null;


            const SESSION_TIME =
                30 * 60 * 1000;


            const isNewSession =
                !lastVisit ||
                (
                    now.getTime() -
                    lastVisit.getTime()
                ) > SESSION_TIME;


            /*
             * Always update visitor.
             */

            await visitorsDB.update(
                {
                    visitorId
                },
                {
                    $set: {
                        lastVisit:
                            now,

                        ipHash,

                        device,

                        browser
                    },

                    $inc: {
                        visits: 1
                    }
                }
            );


            /*
             * Only count a visit when
             * a new session starts.
             */

            if (
                isNewSession ||
                isNewVisitor
            ) {

                await visitsDB.insert({

                    visitorId,

                    dateKey,

                    monthKey,

                    createdAt:
                        now,

                    path:
                        pathVisited,

                    referrer,

                    device,

                    browser,

                    ipHash

                });

            }


            res.json({
                success: true
            });


        } catch (error) {

            console.error(
                "Visitor tracking error:",
                error
            );


            /*
             * Analytics must never break
             * the actual website.
             */

            res.json({
                success: false
            });

        }

    }
);


/* =========================================================
   PUBLIC CONTACT FORM
========================================================= */

app.post(
    "/api/contact",
    async (req, res) => {

        try {

            const {
                name,
                email,
                subject,
                message
            } = req.body;


            if (
                !name ||
                !email ||
                !subject ||
                !message
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "All fields are required"
                });

            }


            if (name.length > 100) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Name is too long"
                });

            }


            if (email.length > 150) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Email is too long"
                });

            }


            if (subject.length > 200) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Subject is too long"
                });

            }


            if (message.length > 5000) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Message is too long"
                });

            }


            const newMessage = {

                name:
                    name.trim(),

                email:
                    email
                        .trim()
                        .toLowerCase(),

                subject:
                    subject.trim(),

                message:
                    message.trim(),

                status:
                    "unread",

                createdAt:
                    new Date(),

                updatedAt:
                    new Date()

            };


            const savedMessage =
                await messagesDB.insert(
                    newMessage
                );


            res.status(201).json({

                success: true,

                message:
                    "Your message has been sent",

                id:
                    savedMessage._id

            });


        } catch (error) {

            console.error(error);


            res.status(500).json({
                success: false,
                message:
                    "Unable to send message"
            });

        }

    }
);


/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

app.get(
    "/api/admin/stats",
    authMiddleware,
    async (req, res) => {

        try {

            const messages =
                await messagesDB.find({});


            const stats = {

                total:
                    messages.length,

                unread:
                    messages.filter(
                        message =>
                            message.status ===
                            "unread"
                    ).length,

                read:
                    messages.filter(
                        message =>
                            message.status ===
                            "read"
                    ).length,

                replied:
                    messages.filter(
                        message =>
                            message.status ===
                            "replied"
                    ).length

            };


            res.json({
                success: true,
                stats
            });


        } catch (error) {

            console.error(error);


            res.status(500).json({
                success: false,
                message:
                    "Unable to load statistics"
            });

        }

    }
);


/* =========================================================
   VISITOR STATISTICS
========================================================= */

app.get(
    "/api/admin/visitor-stats",
    authMiddleware,
    async (req, res) => {

        try {

            const today =
                getDateKey();


            const yesterday =
                getYesterdayKey();


            const thisMonth =
                getMonthKey();


            const [
                totalVisits,
                todayVisits,
                yesterdayVisits,
                monthVisits,
                uniqueVisitors
            ] = await Promise.all([

                visitsDB.count({}),

                visitsDB.count({
                    dateKey:
                        today
                }),

                visitsDB.count({
                    dateKey:
                        yesterday
                }),

                visitsDB.count({
                    monthKey:
                        thisMonth
                }),

                visitorsDB.count({})

            ]);


            /*
             * Last 7 days
             */

            const daily =
                [];


            for (
                let i = 6;
                i >= 0;
                i--
            ) {

                const date =
                    new Date();


                date.setUTCDate(
                    date.getUTCDate() - i
                );


                const dateKey =
                    getDateKey(date);


                const count =
                    await visitsDB.count({
                        dateKey
                    });


                daily.push({

                    date:
                        dateKey,

                    visits:
                        count

                });

            }


            /*
             * Devices
             */

            const visits =
                await visitsDB.find({});


            const devices = {};

            const browsers = {};


            for (
                const visit of visits
            ) {

                const device =
                    visit.device ||
                    "Unknown";


                const browser =
                    visit.browser ||
                    "Unknown";


                devices[device] =
                    (devices[device] || 0) + 1;


                browsers[browser] =
                    (browsers[browser] || 0) + 1;

            }


            res.json({

                success: true,

                stats: {

                    totalVisits,

                    uniqueVisitors,

                    todayVisits,

                    yesterdayVisits,

                    monthVisits,

                    daily,

                    devices,

                    browsers

                }

            });


        } catch (error) {

            console.error(
                "Visitor stats error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load visitor statistics"

            });

        }

    }
);


/* =========================================================
   GET ALL MESSAGES
========================================================= */

app.get(
    "/api/admin/messages",
    authMiddleware,
    async (req, res) => {

        try {

            const messages =
                await messagesDB
                    .find({})
                    .sort({
                        createdAt: -1
                    });


            res.json({
                success: true,
                messages
            });


        } catch (error) {

            console.error(error);


            res.status(500).json({
                success: false,
                message:
                    "Unable to load messages"
            });

        }

    }
);


/* =========================================================
   GET ONE MESSAGE
========================================================= */

app.get(
    "/api/admin/messages/:id",
    authMiddleware,
    async (req, res) => {

        try {

            const message =
                await messagesDB.findOne({
                    _id:
                        req.params.id
                });


            if (!message) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Message not found"
                });

            }


            res.json({
                success: true,
                message
            });


        } catch (error) {

            console.error(error);


            res.status(500).json({
                success: false,
                message:
                    "Unable to load message"
            });

        }

    }
);


/* =========================================================
   UPDATE MESSAGE STATUS
========================================================= */

app.patch(
    "/api/admin/messages/:id/status",
    authMiddleware,
    async (req, res) => {

        try {

            const {
                status
            } = req.body;


            const allowedStatuses = [
                "unread",
                "read",
                "replied"
            ];


            if (
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid status"
                });

            }


            const updated =
                await messagesDB.update(

                    {
                        _id:
                            req.params.id
                    },

                    {
                        $set: {

                            status,

                            updatedAt:
                                new Date()

                        }
                    },

                    {
                        returnUpdatedDocs:
                            true
                    }

                );


            if (!updated) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Message not found"
                });

            }


            res.json({
                success: true,
                message:
                    "Status updated"
            });


        } catch (error) {

            console.error(error);


            res.status(500).json({
                success: false,
                message:
                    "Unable to update status"
            });

        }

    }
);


/* =========================================================
   DELETE MESSAGE
========================================================= */

app.delete(
    "/api/admin/messages/:id",
    authMiddleware,
    async (req, res) => {

        try {

            const deleted =
                await messagesDB.remove(
                    {
                        _id:
                            req.params.id
                    },
                    {}
                );


            if (!deleted) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Message not found"
                });

            }


            res.json({
                success: true,
                message:
                    "Message deleted"
            });


        } catch (error) {

            console.error(error);


            res.status(500).json({
                success: false,
                message:
                    "Unable to delete message"
            });

        }

    }
);


/* =========================================================
   ADMIN PAGE
========================================================= */

app.get(
    "/admin",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "admin",
                "index.html"
            )
        );

    }
);


/* =========================================================
   START SERVER
========================================================= */

async function startServer() {

    try {

        await createAdmin();


        app.listen(
            PORT,
            () => {

                console.log("");

                console.log(
                    `🚀 Portfolio running on http://localhost:${PORT}`
                );

                console.log(
                    `🔐 Admin: http://localhost:${PORT}/admin`
                );

                console.log("");

            }
        );


    } catch (error) {

        console.error(
            "Server startup failed:",
            error
        );

        process.exit(1);

    }

}


startServer();