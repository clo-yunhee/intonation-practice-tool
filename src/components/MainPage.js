import * as React from "react";
import Layout from "./Layout";
import Disable from "./Disable";
import {
    emptyAudioBlob,
    generateAudio,
    encodeToMp3,
    encodeToOgg,
} from "../processing";
import toWav from "audiobuffer-to-wav";

import {
    Box,
    Grid,
    Typography,
    Link,
    TextField,
    Card,
    Slider,
    Select,
    MenuItem,
} from "@material-ui/core";
import { Autocomplete } from "@material-ui/lab";

import enUsPatterns from "hyphenation.en-us";
import { createHyphenator, justifyContent } from "tex-linebreak";

import { AwesomeButton, AwesomeButtonProgress } from "react-awesome-button";

import {
    Player,
    Audio,
    Ui,
    Controls,
    PlaybackControl,
    TimeProgress,
    ScrubberControl,
    VolumeControl,
} from "@vime/react";

import styles from "./MainPage.module.css";

const hyphenate = createHyphenator(enUsPatterns);

const sampleRateOptions = [
    8000, 11025, 16000, 22050, 24000, 32000, 44100, 48000, 96000,
];
const sampleRateLabel = (f) => `${f} Hz`;
const initialSampleRateOut = 24000;

const exportFormats = {
    wav: toWav,
    mp3: encodeToMp3,
    ogg: encodeToOgg,
};

class IndexPage extends React.Component {
    constructor(props) {
        super(props);
        this.layoutRef = React.createRef();
        this.fileInputRef = React.createRef();

        this.state = {
            sampleRateOut: 24000,
            pitchMorph: 1.0,
            filterMorph: 1.0,
            loPitch: 70,
            hiPitch: 190,
            audioInBlobURL: URL.createObjectURL(emptyAudioBlob),
            audioInEmpty: true,
            audioOutBlobURL: URL.createObjectURL(emptyAudioBlob),
            audioOutEmpty: true,
            exportFormat: "mp3",
            howItWorksVisible: false,
        };
    }

    componentDidMount() {
        window.addEventListener("resize", this.justifyParagraphs);
        this.justifyParagraphs();
        this.setState({ context: new AudioContext() });
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.justifyParagraphs);
        this.state.context.close();
        URL.revokeObjectURL(this.state.fileURL);
    }

    justifyParagraphs = () => {
        const paragraphs =
            this.layoutRef.current.querySelectorAll("p[data-justify]");
        justifyContent(Array.from(paragraphs), hyphenate);
    };

    handleFileDialog = () => {
        this.fileInputRef.current.click();
    };

    handleFileChanged = () => {
        const file = this.fileInputRef.current.files[0];
        const fileURL = URL.createObjectURL(file);

        const request = new XMLHttpRequest();
        request.open("GET", fileURL, true);
        request.responseType = "arraybuffer";
        request.onload = () => {
            URL.revokeObjectURL(fileURL);
            this.state.context
                .decodeAudioData(request.response)
                .then((buffer) => {
                    // Use the WebAudio API to resample the audio to 16kHz.
                    const targetSampleRate = 16000;
                    const targetLength = Math.ceil(
                        buffer.duration * targetSampleRate
                    );
                    const offlineContext = new OfflineAudioContext(
                        1,
                        targetLength,
                        targetSampleRate
                    );
                    const source = offlineContext.createBufferSource();
                    source.buffer = buffer;
                    source.connect(offlineContext.destination);
                    source.start();

                    offlineContext.startRendering().then((resampledBuffer) => {
                        const wav = toWav(resampledBuffer);
                        const blob = new Blob([new DataView(wav)], {
                            type: "audio/wav",
                        });

                        URL.revokeObjectURL(this.state?.audioInBlobURL);

                        this.setState({
                            audioInBuffer: resampledBuffer,
                            audioInBlobURL: URL.createObjectURL(blob),
                            audioInEmpty: false,
                        });
                    });
                });
        };
        request.onabort = () => URL.revokeObjectURL(fileURL);
        request.onerror = () => URL.revokeObjectURL(fileURL);
        request.send();
    };

    handleGenerate = (elt, next) => {
        const { audioInBuffer, sampleRateOut, pitchMorph, filterMorph } =
            this.state;

        generateAudio(
            audioInBuffer,
            {
                progress: this.audioProgress,
                finished: this.audioFinished(next),
            },
            {
                sampleRateOut,
                pitchMorph,
                filterMorph,
                synthMethod: "",
                loPitch: 70,
                hiPitch: 300,
            }
        );
    };

    handleSampleRate = (e, newValue) => {
        this.setState({ sampleRateOut: newValue });
    };

    handlePitchMorph = (e, newValue) => {
        this.setState({ pitchMorph: newValue });
    };

    handleFilterMorph = (e, newValue) => {
        this.setState({ filterMorph: newValue });
    };

    audioProgress = (data) => {};

    audioFinished = (next) => (data) => {
        const { sampleRateOut } = this.state;

        const buffer = new AudioBuffer({
            length: data.length,
            numberOfChannels: 1,
            sampleRate: sampleRateOut,
        });
        buffer.copyToChannel(data, 0, 0);

        const wav = toWav(buffer);
        const blob = new Blob([new DataView(wav)], {
            type: "audio/wav",
        });

        URL.revokeObjectURL(this.state?.audioOutBlobURL);

        this.setState({
            audioOutBuffer: buffer,
            audioOutDurationMs: Math.round(buffer.duration * 1000),
            audioOutBlobURL: URL.createObjectURL(blob),
            audioOutEmpty: false,
        });

        next();
    };

    handleSelectDownloadFormat = (e) => {
        this.setState({ exportFormat: e.target.value });
    };

    handleDownload = async () => {
        const fileExt = this.state.exportFormat;
        const exportFunc = exportFormats[fileExt];

        const arrayBuffer = await exportFunc(this.state.audioOutBuffer);

        const blob = new Blob([new DataView(arrayBuffer)], {
            type: `audio/${fileExt}`,
        });

        const blobURL = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobURL;
        link.setAttribute("download", `generated.${fileExt}`);

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(blobURL);
    };

    handleToggleHowItWorks = (visible) => () => {
        this.setState({ howItWorksVisible: visible });
    };

    render() {
        const {
            sampleRateOut,
            pitchMorph,
            filterMorph,
            audioInBlobURL,
            audioInEmpty,
            audioOutBlobURL,
            audioOutEmpty,
            exportFormat,
            howItWorksVisible,
        } = this.state;

        return (
            <Layout mainRef={this.layoutRef}>
                <div
                    className={`${styles.mainUi} ${
                        howItWorksVisible ? styles.mainUiHidden : ""
                    }`}
                >
                    <Box my="calc(6px + 1vh)">
                        <Grid
                            container
                            direction="column"
                            justifyContent="center"
                            alignItems="center"
                            spacing={1}
                        >
                            <Grid item>
                                <Box my="calc(6px + 0.6vh)">
                                    <Grid
                                        container
                                        direction="row"
                                        justifyContent="center"
                                        alignItems="center"
                                        spacing={3}
                                    >
                                        <input
                                            className={styles.fileInput}
                                            ref={this.fileInputRef}
                                            accept="audio/*"
                                            capture="user"
                                            type="file"
                                            onChange={this.handleFileChanged}
                                        />
                                        <AwesomeButton
                                            onPress={this.handleFileDialog}
                                        >
                                            Choose an audio file
                                        </AwesomeButton>
                                    </Grid>
                                </Box>
                            </Grid>
                            <Grid item>
                                <Card
                                    className={styles.audioPlayerBox}
                                    ref={this.audioInPlayer}
                                >
                                    <Disable disabled={audioInEmpty}>
                                        <Player theme="dark" icons="material">
                                            <Audio>
                                                <source
                                                    data-src={audioInBlobURL}
                                                    src={audioInBlobURL}
                                                    type="audio/wav"
                                                />
                                            </Audio>

                                            <Ui>
                                                <Controls>
                                                    <PlaybackControl />
                                                    <ScrubberControl />
                                                    <TimeProgress />
                                                    <VolumeControl />
                                                </Controls>
                                            </Ui>
                                        </Player>
                                    </Disable>
                                </Card>
                            </Grid>
                        </Grid>
                    </Box>

                    <Box my="calc(6px + 1vh)">
                        <Grid
                            container
                            direction="row"
                            justifyContent="center"
                            alignItems="center"
                            spacing={4}
                        >
                            <Grid item>
                                <Typography
                                    variant="subtitle2"
                                    color="textSecondary"
                                    gutterBottom
                                >
                                    Output sample rate
                                </Typography>
                                <Autocomplete
                                    options={sampleRateOptions}
                                    getOptionLabel={sampleRateLabel}
                                    freeSolo
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            className={styles.settingInputClass}
                                        />
                                    )}
                                    defaultValue={initialSampleRateOut}
                                    onChange={this.handleSampleRate}
                                />
                            </Grid>

                            <Grid item>
                                <Box pr={2}>
                                    <Typography
                                        variant="subtitle2"
                                        color="textSecondary"
                                        gutterBottom
                                    >
                                        Pitch morph factor
                                    </Typography>
                                </Box>
                                <Grid
                                    container
                                    direction="row"
                                    alignItems="center"
                                >
                                    <Slider
                                        defaultValue={1}
                                        className={styles.settingInputClass}
                                        step={0.05}
                                        min={0.25}
                                        max={2.5}
                                        onChange={this.handlePitchMorph}
                                    />
                                    <Box ml={2}>
                                        {Math.round(100 * pitchMorph)} %
                                    </Box>
                                </Grid>
                            </Grid>

                            <Grid item>
                                <Box pr={2}>
                                    <Typography
                                        variant="subtitle2"
                                        color="textSecondary"
                                        gutterBottom
                                    >
                                        Filter morph factor
                                    </Typography>
                                </Box>
                                <Grid
                                    container
                                    direction="row"
                                    alignItems="center"
                                >
                                    <Slider
                                        defaultValue={1}
                                        className={styles.settingInputClass}
                                        step={0.05}
                                        min={0.25}
                                        max={4.0}
                                        onChange={this.handleFilterMorph}
                                    />
                                    <Box ml={2}>
                                        {Math.round(100 * filterMorph)} %
                                    </Box>
                                </Grid>
                            </Grid>
                        </Grid>
                    </Box>

                    <Box my="calc(6px + 1vh)">
                        <AwesomeButtonProgress
                            type="secondary"
                            onPress={this.handleGenerate}
                            disabled={audioInEmpty}
                            releaseDelay={1000}
                            resultLabel="Finished!"
                        >
                            Generate
                        </AwesomeButtonProgress>
                    </Box>

                    <Grid
                        container
                        direction="column"
                        justifyContent="center"
                        alignItems="center"
                        spacing={1}
                    >
                        <Grid item>
                            <Card className={styles.audioPlayerBox}>
                                <Disable disabled={audioOutEmpty}>
                                    <Player theme="dark" icons="material">
                                        <Audio>
                                            <source
                                                data-src={audioOutBlobURL}
                                                src={audioOutBlobURL}
                                                type="audio/wav"
                                            />
                                        </Audio>

                                        <Ui>
                                            <Controls>
                                                <PlaybackControl />
                                                <ScrubberControl />
                                                <TimeProgress />
                                                <VolumeControl />
                                            </Controls>
                                        </Ui>
                                    </Player>
                                </Disable>
                            </Card>
                        </Grid>
                        <Grid item>
                            <Grid
                                container
                                direction="row"
                                justifyContent="center"
                                alignItems="center"
                                spacing={1}
                            >
                                <Grid item>
                                    <AwesomeButton
                                        onPress={this.handleDownload}
                                        disabled={audioOutEmpty}
                                    >
                                        Download
                                    </AwesomeButton>
                                </Grid>
                                <Grid item>
                                    <Select
                                        value={exportFormat}
                                        onChange={
                                            this.handleSelectDownloadFormat
                                        }
                                    >
                                        <MenuItem value="wav">WAV</MenuItem>
                                        <MenuItem value="mp3">MP3</MenuItem>
                                        <MenuItem value="ogg">
                                            OGG Vorbis
                                        </MenuItem>
                                    </Select>
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>

                    <Box my="calc(6px + 1vh)" className={styles.appDescription}>
                        <p data-justify>
                            This site is a web application that extracts the
                            pitch contour from audio to generate an isolated
                            signal for speech intonation practice. This app was
                            built to run entirely in the browser, with no server
                            communication. After the page was loaded at least
                            once you can return to this address even when your
                            device is offline.
                        </p>
                        <Link
                            component="button"
                            onClick={this.handleToggleHowItWorks(true)}
                        >
                            <Typography>Tell me how it works</Typography>
                        </Link>
                    </Box>
                </div>

                <Box
                    className={`${styles.howItWorks} ${
                        howItWorksVisible ? "" : styles.howItWorksHidden
                    }`}
                >
                    <p data-justify>
                        The pitch contour is estimated with David Talkin's{" "}
                        <Link
                            href="https://github.com/google/REAPER"
                            target="_blank"
                        >
                            REAPER
                        </Link>{" "}
                        pitch tracking algorithm. You can configure the
                        synthesizer to scale the pitch estimates; they are
                        scaled logarithmically according to the{" "}
                        <Link
                            href="https://en.wikipedia.org/wiki/Equivalent_rectangular_bandwidth"
                            target="_blank"
                        >
                            ERB
                        </Link>{" "}
                        frequency scale. The synthesis is done using the
                        Liljencrantz-Fant glottal flow model with a single
                        regression parameter as described in{" "}
                        <Link
                            href="https://hal.archives-ouvertes.fr/hal-00773352/document"
                            target="_blank"
                        >
                            this paper
                        </Link>
                        . You can configure a pitch-to-R<sub>d</sub>{" "}
                        interpolation curve. In order to make voicing
                        transitions sound more realistic the R<sub>d</sub>{" "}
                        parameter is lowered at the start and end of voiced
                        spurts. Real voices are more complex than that but it
                        seems to be a good enough approximation. The glottal
                        source is then mixed with brown (1&#x29f8;f
                        <sup>2</sup>) noise to simulate aspirate noise. It is
                        then passed through a precomputed vocal tract filter
                        that models the /m/ consonant. The filter was created
                        with the help of{" "}
                        <Link
                            href="https://www.fon.hum.uva.nl/rob/Courses/InformationInSpeech/CDROM/Literature/LOTwinterschool2006/speech.bme.ogi.edu/tutordemos/SpectrogramReading/cse551html/cse551/node35.html"
                            target="_blank"
                        >
                            this page
                        </Link>{" "}
                        and{" "}
                        <Link
                            href="https://core.ac.uk/download/pdf/16521455.pdf"
                            target="_blank"
                        >
                            this paper
                        </Link>
                        .
                    </p>
                    <p data-justify>
                        In terms of implementation, due to the computationally
                        intensive nature of such audio processing, the bulk of
                        it is done in a WebAssembly module written in C++ in
                        order to optimize for speed. The rest of the app is
                        written in JavaScript using the popular web frameworks{" "}
                        <Link href="https://gatsbyjs.com" target="_blank">
                            Gatsby
                        </Link>
                        ,{" "}
                        <Link href="https://reactjs.org" target="_blank">
                            React
                        </Link>
                        , and{" "}
                        <Link href="https://rmaterial-ui.com" target="_blank">
                            Material-UI
                        </Link>
                        .
                    </p>
                    <Box mt="calc(6px + 3vh)">
                        <Link
                            component="button"
                            onClick={this.handleToggleHowItWorks(false)}
                        >
                            <Typography>Hide</Typography>
                        </Link>
                    </Box>
                </Box>
            </Layout>
        );
    }
}

export default IndexPage;
