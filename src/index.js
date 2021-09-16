import React from "react";
import { render } from "react-dom";
import {
    createTheme,
    ThemeProvider,
    CssBaseline,
} from "@material-ui/core";

import MainPage from "./components/MainPage";

import "./index.css";
import "./aws-theme-c137-modified.css";

const theme = createTheme({
    palette: {
        type: "dark",
        primary: {
            main: "#c8a2c8",
        },
        secondary: {
            light: "#0066ff",
            main: "#0044ff",
            contrastText: "#ffcc00",
        },
        contrastThreshold: 3,
        tonalOffset: 0.2,
    },
});

render(
    <ThemeProvider theme={theme}>
        <CssBaseline />
        <MainPage />
    </ThemeProvider>,
    document.getElementById("root")
);
