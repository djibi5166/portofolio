/* =========================================================
   MOBILE MENU
========================================================= */

const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

if (menuToggle && navLinks) {

    menuToggle.addEventListener("click", () => {

        navLinks.classList.toggle("open");

        const icon = menuToggle.querySelector("i");

        if (!icon) return;

        if (navLinks.classList.contains("open")) {

            icon.classList.remove("fa-bars");
            icon.classList.add("fa-xmark");

        } else {

            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");

        }

    });


    /* Close mobile menu after clicking a link */

    document.querySelectorAll(".nav-link").forEach(link => {

        link.addEventListener("click", () => {

            navLinks.classList.remove("open");

            const icon =
                menuToggle.querySelector("i");

            if (!icon) return;

            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");

        });

    });

}


/* =========================================================
   HEADER SCROLL
========================================================= */

const header =
    document.querySelector(".header");

if (header) {

    window.addEventListener("scroll", () => {

        if (window.scrollY > 40) {

            header.classList.add("scrolled");

        } else {

            header.classList.remove("scrolled");

        }

    });

}


/* =========================================================
   INTERSECTION OBSERVER
========================================================= */

const revealElements =
    document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {

    const observer = new IntersectionObserver(
        (entries, observer) => {

            entries.forEach(entry => {

                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.add("visible");

                /*
                 * Stop observing after the animation
                 * has been triggered.
                 */

                observer.unobserve(entry.target);

            });

        },
        {
            threshold: 0.12,
            rootMargin: "0px 0px -50px 0px"
        }
    );


    revealElements.forEach(element => {

        observer.observe(element);

    });

} else {

    /*
     * Fallback for browsers without
     * IntersectionObserver.
     */

    revealElements.forEach(element => {

        element.classList.add("visible");

    });

}


/* =========================================================
   SKILL BAR ANIMATION
========================================================= */

const skillCards =
    document.querySelectorAll(".skill-card");

if ("IntersectionObserver" in window) {

    const skillObserver =
        new IntersectionObserver(
            (entries, observer) => {

                entries.forEach(entry => {

                    if (!entry.isIntersecting) {
                        return;
                    }


                    const bar =
                        entry.target.querySelector(
                            ".skill-bar span"
                        );


                    if (bar) {

                        bar.style.transform =
                            "scaleX(1)";

                    }


                    observer.unobserve(
                        entry.target
                    );

                });

            },
            {
                threshold: 0.3
            }
        );


    skillCards.forEach(card => {

        skillObserver.observe(card);

    });

} else {

    skillCards.forEach(card => {

        const bar =
            card.querySelector(
                ".skill-bar span"
            );

        if (bar) {
            bar.style.transform = "scaleX(1)";
        }

    });

}


/* =========================================================
   ACTIVE NAVIGATION
========================================================= */

const sections =
    document.querySelectorAll("section[id]");

const navItems =
    document.querySelectorAll(".nav-link");


if ("IntersectionObserver" in window) {

    const sectionObserver =
        new IntersectionObserver(
            entries => {

                entries.forEach(entry => {

                    if (!entry.isIntersecting) {
                        return;
                    }


                    const currentId =
                        entry.target.id;


                    navItems.forEach(link => {

                        link.classList.remove(
                            "active"
                        );


                        if (
                            link.getAttribute("href") ===
                            `#${currentId}`
                        ) {

                            link.classList.add(
                                "active"
                            );

                        }

                    });

                });

            },
            {
                threshold: 0.35
            }
        );


    sections.forEach(section => {

        sectionObserver.observe(section);

    });

}


/* =========================================================
   CONTACT FORM
========================================================= */

const contactForm =
    document.getElementById("contactForm");

const formMessage =
    document.getElementById("formMessage");


if (contactForm) {

    contactForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const button =
                contactForm.querySelector(
                    "button[type='submit']"
                );


            const buttonText =
                button?.querySelector("span");


            const formData =
                new FormData(contactForm);


            const data = {

                name:
                    String(
                        formData.get("name") || ""
                    ).trim(),

                email:
                    String(
                        formData.get("email") || ""
                    ).trim(),

                subject:
                    String(
                        formData.get("subject") || ""
                    ).trim(),

                message:
                    String(
                        formData.get("message") || ""
                    ).trim()

            };


            /*
             * Basic frontend validation.
             */

            if (
                !data.name ||
                !data.email ||
                !data.subject ||
                !data.message
            ) {

                if (formMessage) {

                    formMessage.textContent =
                        "Please complete all fields.";

                    formMessage.style.color =
                        "#ff6b6b";

                }

                return;

            }


            /*
             * Disable button while sending.
             */

            if (button) {
                button.disabled = true;
            }


            if (buttonText) {

                buttonText.textContent =
                    "Sending...";

            }


            if (formMessage) {

                formMessage.textContent = "";

            }


            try {

                const response =
                    await fetch(
                        "/api/contact",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify(data)
                        }
                    );


                /*
                 * Try to parse JSON safely.
                 */

                let result = {};

                try {

                    result =
                        await response.json();

                } catch {

                    result = {};

                }


                /*
                 * Backend returned an error.
                 */

                if (!response.ok) {

                    throw new Error(
                        result.message ||
                        "Unable to send your message."
                    );

                }


                /*
                 * SUCCESS
                 */

                if (formMessage) {

                    formMessage.textContent =
                        "✓ Message sent successfully!";

                    formMessage.style.color =
                        "#00f2fe";

                }


                contactForm.reset();


            } catch (error) {

                console.error(
                    "Contact form error:",
                    error
                );


                if (formMessage) {

                    formMessage.textContent =
                        error.message ||
                        "Unable to send your message.";

                    formMessage.style.color =
                        "#ff6b6b";

                }

            } finally {

                /*
                 * Enable button again.
                 */

                if (button) {

                    button.disabled = false;

                }


                if (buttonText) {

                    buttonText.textContent =
                        "Send Message";

                }

            }

        }
    );

}


/* =========================================================
   CURRENT YEAR
========================================================= */

const yearElement =
    document.getElementById("year");

if (yearElement) {

    yearElement.textContent =
        new Date().getFullYear();

}