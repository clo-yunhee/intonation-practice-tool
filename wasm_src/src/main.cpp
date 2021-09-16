#include "reaper/reaper.h"
#include "GlottalSource.h"
#include "FilterDesign.h"
#include "Noise.h"
#include <emscripten/val.h>
#include <cmath>
#include <iostream>

using emscripten::val;

constexpr double lerp(double x, double x0, double x1, double y0, double y1) {
    return y0 + (x - x0) / (x1 - x0) * (y1 - y0);
}

constexpr double S2(double x) {
    const double x2 = x * x;
    const double x3 = x * x2;
    const double x4 = x2 * x2;
    const double x5 = x2 * x3;

    return 6 * x5 - 15 * x4 + 10 * x3;
}

constexpr double smoothstep(double x, double x0, double x1, double y0, double y1) {
    if (x < x0) return y0;
    else if (x > x1) return y1;

    // x in [x0,x1] => t in [0,1]
    const double t = (x - x0) / (x1 - x0);
    // s in [0,1] => y in [y0,y1]
    return y0 + S2(t) * (y1 - y0);
}

/*--- ERB functions */

constexpr double A = 21.33228113095401739888262;
constexpr double b = 0.00437;

inline double hz2erb(double f) {
    return A * log10(1 + b * f);
}

inline double erb2hz(double erb) {
    return (pow(10.0, erb / A) - 1) / b;
}

inline double erbMorph(double f, double m) {
    //return erb2hz(m * hz2erb(f));
    //  = ((1 + b*f)^m - 1) / A

    return (pow(1 + b * f, m) - 1) / b;
}

/*--- Constants */

constexpr int sampleRateIn = 16000;

constexpr double zeroRd = 0.6;
constexpr double loRd = 0.8;
constexpr double hiRd = 2.7;

constexpr double relativeNoiseGain = 0.01;

/*
Filter for /m/ :

f, bw
-- poles:
200, 20
400, 60
1000, 100
1200, 60
3000, 250
3500, 310
4400, 400
-- zeros:
500, 40
1500, 130

=========
Fig 3-5
from Synthesis of Nasal Consonants: A Theoretically Based Approach
by Andrew Ian Russell
*/

// More readable than true/false in the static array
// The flag is used to keep constant the poles and zeros attributed to nasality 
constexpr int yes = int(true);
constexpr int no  = int(false);

constexpr std::array poleFreqs{ 250, 1200, 3000, 3500, 4400 };
constexpr std::array poleBands{  20,   80,  250,  310,  400 };
constexpr std::array poleMorph{  no,  yes,  yes,  yes,  yes };

constexpr std::array zeroFreqs{ 400, 1500 };
constexpr std::array zeroBands{  40,  130 };
constexpr std::array zeroMorph{  no,  yes };

/*--- Main logic */

template<typename T>
auto cplxRes(T freqs, T bands, T morphable, int fs, double morph)
{
    static_assert(freqs.size() == bands.size());
    static_assert(freqs.size() == morphable.size());

    const double bwMorph = 1 + 1.2 * (morph - 1);

    constexpr int n = freqs.size();
    std::vector<std::complex<double>> cplx(2 * n);
    for (int i = 0; i < n; ++i) {
        const double fc = morphable[i] ? erbMorph(freqs[i], morph) : freqs[i];
        const double bw = morphable[i] ? erbMorph(bands[i], bwMorph) : bands[i];

        const double r = exp(-PI * bw / fs);
        const double phi = 2 * PI * fc / fs;

        cplx[i] = std::polar(r, phi);
        cplx[n + i] = std::conj(cplx[i]);
    }
    return cplx;
}

inline std::vector<std::complex<double>> cplxPoles(int fs, double morph)
{
    return cplxRes(poleFreqs, poleBands, poleMorph, fs, morph);
}

inline std::vector<std::complex<double>> cplxZeros(int fs)
{
    return cplxRes(zeroFreqs, zeroBands, zeroMorph, fs, 1.0);
}

extern "C" {

void generateAudio(
            const float *input,
            const int length,
            float *outputPtr,
            const int outLength,
            const int sampleRateOut,
            const double pitchMorph,
            const double filterMorph,
            const std::string& synthMethod,
            const double loPitch,
            const double hiPitch,
            val progressCallback
        )
{
    std::cout << "dur: " << (double(length) / double (sampleRateIn)) << "  "
              << "fsout: " << sampleRateOut << "  "
              << "pitchMorph: " << pitchMorph << "  "
              << "filterMorph: " << filterMorph << "  "
              << "synthMethod: " << synthMethod << "  "
              << "loPitch: " << loPitch << "  "
              << "hiPitch: " << hiPitch << std::endl;

    const int voicingWindowLength2 = round(20.0 / 1000.0 * sampleRateOut);
    const int voicingWindowLength = round(200.0 / 1000.0 * sampleRateOut);
    const int voicingWindowSpacing = round(60.0 / 1000.0 * sampleRateOut);

    auto lpsos = Butterworth::lowPass(6, sampleRateOut / 2.0 - 2000.0, sampleRateOut);
    auto hpsos = Butterworth::highPass(2, 3500.0, sampleRateOut);
    auto msos = zpk2sos(cplxZeros(sampleRateOut), cplxPoles(sampleRateOut, filterMorph), 1.0);

    // Extract pitch information
    Track *f0 = nullptr;
    ReaperAnalyze(input, length, sampleRateIn, &f0);

    // Morph pitch track
    for (int i = 0; i < f0->num_frames(); ++i) {
        if (f0->v(i)) {
            f0->a(i) = erbMorph(f0->a(i), pitchMorph);
        }
    }

    // Generate source
    GlottalSource source;
    source.setSampleRate(sampleRateOut);

    std::vector<double> output(outLength);

    for (int i = 0; i < outLength; ++i) {
        const double time = double(i) / double(sampleRateOut);

        const int indexBelow = f0->IndexBelow(time);
        const int indexAbove = f0->IndexAbove(time);
        const double timeBelow = f0->t(indexBelow);
        const double timeAbove = f0->t(indexAbove);
        const bool voicingBelow = f0->v(indexBelow);
        const bool voicingAbove = f0->v(indexAbove);

        if (voicingBelow || voicingAbove) {
            const double pitchBelow = f0->a(indexBelow);
            const double pitchAbove = f0->a(indexAbove);
            double pitch;

            if (!voicingBelow) {
                pitch = pitchAbove;
            }
            else if (!voicingAbove) {
                pitch = pitchBelow;
            }
            else {
                pitch = smoothstep(time, timeBelow, timeAbove, pitchBelow, pitchAbove);
            }

            double Rd = smoothstep(pitch, loPitch, hiPitch, loRd, hiRd);
            
            int sum = 0;
            for (int j = 0; j < voicingWindowLength2; ++j) {
                const int index = i + j - voicingWindowLength2 / 2;
                const double time = double(index) / double(sampleRateOut);
                const double pitchTrackIndex = f0->Index(time);
                if (f0->v(pitchTrackIndex)) {
                    sum++;
                }
            }

            Rd = zeroRd + (Rd - zeroRd) * double(sum) / double(voicingWindowLength2);

            source.setPitch(pitch, 0.005);
            source.setRd(Rd, 0.008);
            source.setVoicing(true);
        }
        else {
            source.setRd(zeroRd, 0.002);
            source.setVoicing(false);
        }

        output[i] = source.generateFrame();

        if (!isnormal(output[i])) {
            output[i] = 0.0;
        }
    }

    // Anti-aliasing lowpass filter.
    output = sosfilter(lpsos, output);

    // Add noise.
    auto noise = Noise::tilted(outLength, -2.0);

    double audioAmplitude = 0.0;
    double noiseAmplitude = 0.0;
    for (int i = 0; i < outLength; ++i) {
        if (std::abs(output[i]) > audioAmplitude)
            audioAmplitude = std::abs(output[i]);
        if (std::abs(noise[i]) > noiseAmplitude)
            noiseAmplitude = std::abs(noise[i]);
    }

    for (int i = 0; i < outLength; ++i) {
        output[i] += relativeNoiseGain * audioAmplitude * noise[i] / noiseAmplitude;
    }

    // Apply voicing contour with Hann window.
    std::vector<double> voicingWindow(voicingWindowLength);
    std::vector<double> voicingWindow2(voicingWindowLength);
    for (int j = 0; j < voicingWindowLength; ++j) {
        voicingWindow[j] = 0.5 - 0.5 * std::cos((2.0 * PI * double(j)) / voicingWindowLength);

        const double x = (double(j) - double(voicingWindowLength) / 2) / (double(voicingWindowLength) / 2);
        voicingWindow2[j] = 1.0 - x * x;
    }

    std::vector<double> weights(outLength);

    for (int iq = 0; iq < outLength / voicingWindowSpacing; ++iq) {
        const int i = iq * voicingWindowSpacing;

        double sum = 0.0;
        double quot = 0.0;

        for (int j = 0; j < voicingWindowLength; ++j) {
            const int index = i + j - voicingWindowLength / 2;
            const double time = double(index) / double(sampleRateOut);
            const double pitchTrackIndex = f0->Index(time);
            const double sample = f0->v(pitchTrackIndex) ? 1.0 : 0.0;
            sum += voicingWindow[j] * sample;
            quot += voicingWindow[j];
        }

        for (int j = 0; j < voicingWindowLength; ++j) {
            const int index = i + j - voicingWindowLength / 2;
            if (index >= 0 && index < outLength) {
                weights[index] += voicingWindow2[j] * sum / quot;
            }
        }
    }

    for (int i = 0; i < outLength; ++i) {
        output[i] *= weights[i];
    }

    // Filter with the static /m/ consonant filter.
    output = sosfilter(msos, output);
    
    // Normalize.
    double normAmplitude = 0.0;
    for (int i = 0; i < outLength; ++i) {
        if (std::abs(output[i]) > normAmplitude) {
            normAmplitude = std::abs(output[i]);
        }
    }
    if (normAmplitude > 0.0) {
        for (int i = 0; i < outLength; ++i) {
            output[i] /= normAmplitude;
        }
    }

    // Copy to output ptr.
    for (int i = 0; i < outLength; ++i) {
        outputPtr[i] = output[i];
    }

    delete f0;
}

} // extern