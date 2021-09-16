#include "GlottalSource.h"
#include <cmath>

GlottalSource::GlottalSource()
    : mSampleRate(48'000)
{
}

void GlottalSource::setSampleRate(int sampleRate)
{
    mSampleRate = sampleRate;
    mFirst = true;
    mVoicingMultiplier = 0.0;
}

void GlottalSource::setRd(double Rd, double rubber)
{
    if (mFirst) {
        mRd = Rd;
    }
    mRdTarget = Rd;
    mRdTargetVelocity = 1.0 - rubber;
}

void GlottalSource::setPitch(double pitch, double rubber)
{
    if (mFirst) {
        mPitch = pitch;
    }
    mPitchTarget = pitch;
    mPitchTargetVelocity = 1.0 - rubber;
}

void GlottalSource::setVoicing(bool voicing)
{
    mVoicingTarget = voicing;
}

double GlottalSource::generateFrame()
{
    const double distance = 0.05 / 1000.0 * double(mSampleRate);
    
    mRd = mRd * std::pow(1 - mRdTargetVelocity, distance) + mRdTarget * std::pow(mRdTargetVelocity, distance);
    mPitch = mPitch * std::pow(1 - mPitchTargetVelocity, distance) + mPitchTarget * std::pow(mPitchTargetVelocity, distance);

    lfGenerator.setPeriod(int(mSampleRate / mPitch));

    double timeInPeriod;
    double sample = lfGenerator.generateFrame(&timeInPeriod);
    sample *= std::cbrt(mVoicingMultiplier);
    
    if (timeInPeriod >= 1) {
        lfGenerator.setRd(mRd);
        mVoicingMultiplier = (mVoicingTarget ? 1.0 : 0.0);
    }

    //wxAppConsole::GetInstance()->Yield();

    return sample;
}