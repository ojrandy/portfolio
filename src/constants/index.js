const navLinks = [
    {
        name: "Work",
        link: "#work",
    },
    {
        name: "Experience",
        link: "#experience",
    },
    {
        name: "Skills",
        link: "#skills",
    },
];

const words = [
    { text: "Ideas", imgPath: "/images/ideas.svg" },
    { text: "Concepts", imgPath: "/images/concepts.svg" },
    { text: "Designs", imgPath: "/images/designs.svg" },
    { text: "Code", imgPath: "/images/code.svg" },
    { text: "Ideas", imgPath: "/images/ideas.svg" },
    { text: "Concepts", imgPath: "/images/concepts.svg" },
    { text: "Designs", imgPath: "/images/designs.svg" },
    { text: "Code", imgPath: "/images/code.svg" },
];

const techStackImgs = [
    {
        name: "React Developer",
        imgPath: "/images/logos/react.png",
    },
    {
        name: "Python Developer",
        imgPath: "/images/logos/python.svg",
    },
    {
        name: "Backend Developer",
        imgPath: "/images/logos/node.png",
    },
    {
        name: "Interactive Developer",
        imgPath: "/images/logos/three.png",
    },
    {
        name: "Project Manager",
        imgPath: "/images/logos/git.svg",
    },
];

const techStackIcons = [
    {
        name: "React Developer",
        modelPath: "/models/react_logo-transformed.glb",
        scale: 1,
        rotation: [0, 0, 0],
    },
    {
        name: "Python Developer",
        modelPath: "/models/python-transformed.glb",
        scale: 0.8,
        rotation: [0, 0, 0],
    },
    {
        name: "Backend Developer",
        modelPath: "/models/node-transformed.glb",
        scale: 5,
        rotation: [0, -Math.PI / 2, 0],
    },
    {
        name: "Interactive Developer",
        modelPath: "/models/three.js-transformed.glb",
        scale: 0.05,
        rotation: [0, 0, 0],
    },
    {
        name: "Git Developer",
        modelPath: "/models/git-svg-transformed.glb",
        scale: 0.05,
        rotation: [0, -Math.PI / 4, 0],
    },
];

const expCards = [
    {
        imgPath: "/images/exp1.png",
        logoPath: "/images/logo1.png",
        title: "Frontend Developer at Bethuel Tech",
        date: "January 2023 - Present",
        responsibilities: [
            "Developed and maintained user-facing features for the Hostinger website.",
            "Collaborated closely with UI/UX designers to ensure seamless user experiences.",
            "Optimized web applications for maximum speed and scalability.",
        ],
    },

    {
        imgPath: "/images/exp2.png",
        logoPath: "/images/logo3.png",
        title: "FLutter Developer",
        date: "June 2024 - Present",
        responsibilities: [
            "Led the development of Flutter based applications, focusing on scalability.",
            "Worked with backend engineers to integrate APIs seamlessly with the frontend.",
            "Contributed to open-source projects that were used with the Docker ecosystem.",
        ],
    },
    {
        imgPath: "/images/exp3.png",
        logoPath: "/images/logo2.png",
        title: "React Native Developer",
        date: "March 2019 - May 2020",
        responsibilities: [
            "Built cross-platform mobile apps using React Native, integrating with Appwrite's backend services.",
            "Improved app performance and user experience through code optimization and testing.",
            "Coordinated with the product team to implement features based on feedback.",
        ],
    },
];

const expLogos = [
    {
        name: "logo1",
        imgPath: "/images/logo1.png",
    },
    {
        name: "logo2",
        imgPath: "/images/logo2.png",
    },
    {
        name: "logo3",
        imgPath: "/images/logo3.png",
    },
];

const socialImgs = [
    {
        name: "insta",
        imgPath: "/images/insta.png",
    },
    {
        name: "fb",
        imgPath: "/images/fb.png",
    },
    {
        name: "x",
        imgPath: "/images/x.png",
    },
    {
        name: "linkedin",
        imgPath: "/images/linkedin.png",
    },
];

export {
    words,
    expCards,
    expLogos,
    socialImgs,
    techStackIcons,
    techStackImgs,
    navLinks,
};
