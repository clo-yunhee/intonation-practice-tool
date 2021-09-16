import * as React from "react";

import {
    Typography,
    Grid,
    Tooltip,
    Link,
} from "@material-ui/core";

import { AwesomeButtonSocial } from "react-awesome-button";

import styles from "./Layout.module.css";

const Layout = ({ mainRef, children }) => {
    return (
            <div className={styles.container}>
                <Typography variant="h3">Intonation Practice Tool</Typography>

                <main className={styles.contentBox} ref={mainRef}>
                    {children}
                </main>

                <Grid
                    container
                    direction="column"
                    justifyContent="center"
                    alignItems="center"
                    spacing={2}
                >
                    <Grid item>
                        <AwesomeButtonSocial
                            href="https://github.com/clo-yunhee/intonation-practice-tool"
                            target="_blank"
                            type="github"
                        >
                            Open on GitHub
                        </AwesomeButtonSocial>
                    </Grid>
                    <Grid item>
                        <Typography variant="body2">
                            Made by Clo Yun-Hee Dufour.
                            <br />
                            Similar projects:{" "}
                            <Tooltip title="a cross-platform real-time voice analysis application">
                                <Link
                                    href="https://in-formant.app"
                                    target="_blank"
                                >
                                    InFormant
                                </Link>
                            </Tooltip>
                            {" | "}
                            <Tooltip title="an experimental web voice synthesiser">
                                <Link
                                    href="https://synth.transvoice.info"
                                    target="_blank"
                                >
                                    voice-synth
                                </Link>
                            </Tooltip>
                            {" | "}
                            <Tooltip title="a header-only formant analysis C library">
                                <Link
                                    href="https://github.com/in-formant/libformants"
                                    target="_blank"
                                >
                                    libformants
                                </Link>
                            </Tooltip>
                        </Typography>
                    </Grid>
                </Grid>
            </div>
    );
};

export default Layout;
