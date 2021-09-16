#ifndef REAPER_H
#define REAPER_H

#include "core/track.h"

inline const char *reaperErr;

bool ReaperAnalyze(const float *audio, int length, int sampleRate, Track **p_f0);

#endif // REAPER_H