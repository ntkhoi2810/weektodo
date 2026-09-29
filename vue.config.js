module.exports = {
  pluginOptions: {
    electronBuilder: {
      nodeIntegration: true,
      customFileProtocol: './',
      builderOptions: {
        appId: "weektodo-app.netlify.app",
        productName: "WeekToDo",
        publish: ["github"],
        linux: {
          category: "Utility",
          description: "Free and Open Source Minimalist Weekly Planner and To Do list App focused on privacy.",
          target: ["deb", "rpm", "pacman","AppImage"],
          icon: "build/icon-mono.png",
        },
        win: {
          target: ["nsis"],
          icon: "build/icon-mono.ico",
        },
        mac: {
          category: "public.app-category.productivity",
          target: ["dmg", "pkg"],
          icon: "build/icon-mono.icns",
        },
      },
    },
  }
};
