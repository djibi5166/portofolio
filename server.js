require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Datastore = require("nedb-promises");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in .env");
}


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
   CREATE ADMIN
========================================================= */

async function createAdmin() {

    const existingAdmin = await usersDB.findOne({
        username: process.env.ADMIN_USERNAME
    });

    if (existingAdmin) {
        return;
    }

    const passwordHash = await bcrypt.hash(
        process.env.ADMIN_PASSWORD,
        12
    );

    await usersDB.insert({
        username: process.env.ADMIN_USERNAME,
        password: passwordHash,
        role: "admin",
        createdAt: new Date()
    });

    console.log(
        `Admin created: ${process.env.ADMIN_USERNAME}`
    );
}


/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post("/api/auth/login", async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;

        if (!username || !password) {

            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });

        }

        const user = await usersDB.findOne({
            username
        });

        if (!user) {

            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
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
                message: "Invalid credentials"
            });

        }

        const token = createToken(user);

        res.cookie(
            "admin_token",
            token,
            {
                httpOnly: true,

                secure:
                    process.env.NODE_ENV === "production",

                sameSite: "lax",

                maxAge:
                    7 * 24 * 60 * 60 * 1000,

                path: "/"
            }
        );

        res.json({
            success: true,
            message: "Login successful"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Login failed"
        });

    }

});


/* =========================================================
   LOGOUT
========================================================= */

app.post(
    "/api/auth/logout",
    authMiddleware,
    (req, res) => {

        res.clearCookie("admin_token", {
            httpOnly: true,
            sameSite: "lax",
            secure:
                process.env.NODE_ENV === "production",
            path: "/"
        });

        res.json({
            success: true,
            message: "Logged out"
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
                id: req.user.id,
                username: req.user.username,
                role: req.user.role
            }
        });

    }
);


/* =========================================================
   PUBLIC CONTACT FORM
========================================================= */

app.post("/api/contact", async (req, res) => {

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
                message: "All fields are required"
            });

        }


        if (name.length > 100) {

            return res.status(400).json({
                success: false,
                message: "Name is too long"
            });

        }


        if (email.length > 150) {

            return res.status(400).json({
                success: false,
                message: "Email is too long"
            });

        }


        if (subject.length > 200) {

            return res.status(400).json({
                success: false,
                message: "Subject is too long"
            });

        }


        if (message.length > 5000) {

            return res.status(400).json({
                success: false,
                message: "Message is too long"
            });

        }


        const newMessage = {

            name: name.trim(),

            email: email.trim().toLowerCase(),

            subject: subject.trim(),

            message: message.trim(),

            status: "unread",

            createdAt: new Date(),

            updatedAt: new Date()

        };


        const savedMessage =
            await messagesDB.insert(newMessage);


        res.status(201).json({
            success: true,
            message: "Your message has been sent",
            id: savedMessage._id
        });


    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to send message"
        });

    }

});


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

                total: messages.length,

                unread:
                    messages.filter(
                        message =>
                            message.status === "unread"
                    ).length,

                read:
                    messages.filter(
                        message =>
                            message.status === "read"
                    ).length,

                replied:
                    messages.filter(
                        message =>
                            message.status === "replied"
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
                message: "Unable to load statistics"
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
                await messagesDB.find({})
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
                message: "Unable to load messages"
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
                    _id: req.params.id
                });


            if (!message) {

                return res.status(404).json({
                    success: false,
                    message: "Message not found"
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
                message: "Unable to load message"
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


            if (!allowedStatuses.includes(status)) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid status"
                });

            }


            const updated =
                await messagesDB.update(
                    {
                        _id: req.params.id
                    },
                    {
                        $set: {
                            status,
                            updatedAt: new Date()
                        }
                    },
                    {
                        returnUpdatedDocs: true
                    }
                );


            if (!updated) {

                return res.status(404).json({
                    success: false,
                    message: "Message not found"
                });

            }


            res.json({
                success: true,
                message: "Status updated"
            });


        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to update status"
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
                        _id: req.params.id
                    },
                    {}
                );


            if (!deleted) {

                return res.status(404).json({
                    success: false,
                    message: "Message not found"
                });

            }


            res.json({
                success: true,
                message: "Message deleted"
            });


        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to delete message"
            });

        }

    }
);


/* =========================================================
   ADMIN PAGE
========================================================= */

app.get("/admin", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "admin",
            "index.html"
        )
    );

});


/* =========================================================
   START SERVER
========================================================= */

async function startServer() {

    try {

        await createAdmin();

        app.listen(PORT, () => {

            console.log("");
            console.log(
                `🚀 Portfolio running on http://localhost:${PORT}`
            );

            console.log(
                `🔐 Admin: http://localhost:${PORT}/admin`
            );

            console.log("");

        });

    } catch (error) {

        console.error(
            "Server startup failed:",
            error
        );

        process.exit(1);

    }

}

startServer();