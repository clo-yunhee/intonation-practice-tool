#include "GlottalModel.h"

LFGenerator::LFGenerator(const double Rd, const int periodInSamples)
    : m_Rd(Rd),
      mPeriodInSamples(periodInSamples),
      m_t(0),
      m_Tc(1.0)
{
    calculateTimeParameters();
    calculateImplicitParameters();
}

void LFGenerator::setRd(double Rd)
{
    m_Rd = Rd;
    calculateTimeParameters();
    calculateImplicitParameters();
}

void LFGenerator::setPeriod(int periodInSamples)
{
    mPeriodInSamples = periodInSamples;
}

double LFGenerator::generateFrame(double *time)
{
    constexpr double Ee = 1;
    const double Tc = m_Tc;
    const double Tp = m_Tp;
    const double Te = m_Te;
    const double Ta = m_Ta;
    const double a = m_alpha;
    const double e = m_epsilon;

    // Use fractional time instead of sample time,
    // to make it possible to change the period mid-cycle.
    double t = m_t + 1.0 / double(mPeriodInSamples);
    *time = t;
    if (t >= 1) {
        t -= 1;
    }
    m_t = t;

    if (t <= Te) {
        return (-Ee * std::exp(a * (t - Te)) * std::sin(PI * t / Tp)) / std::sin(PI * Te / Tp);
    }
    else if (t <= Tc) {
        return -Ee / (e * Ta) * (std::exp(-e * (t - Te)) - std::exp(-e * (Tc - Te)));
    }
    else {
        return 0.0;
    }
}

void LFGenerator::calculateTimeParameters()
{
    const double Rd = m_Rd;

    double Rap;
    double Rkp;
    double Rgp;

    if (Rd <= 2.7) {
        if (Rd < 0.21) {
            Rap = 0;
        }
        else {
            Rap = (-1.0 + 4.8 * Rd) / 100.0;
        }

        Rkp = (22.4 + 11.8 * Rd) / 100.0;
        Rgp = (0.25 * Rkp) / (((0.11 * Rd) / (0.5 + 1.2 * Rkp)) - Rap);
    }
    else {
        const double OQupp = 1.0 - 1.0 / (2.17 * Rd);

        Rkp = (2.0 * Rgp * OQupp) - 1.04;
        Rgp = 0.00935 + 596e-2 / (7.96 - 2 * OQupp);
    }

    const double tp = 1.0 / (2.0 * Rgp);
    const double te = tp * (Rkp + 1.0);
    const double ta = Rap;

    m_Tp = tp;
    m_Te = te;
    m_Ta = ta;
}

void LFGenerator::calculateImplicitParameters()
{
    const double Tc = m_Tc;
    const double Tp = m_Tp;
    const double Te = m_Te;
    const double Ta = m_Ta;
    const double wg = PI / Tp;

    // e is expressed by an implicit equation
    const auto fb = [=](double e) {
        return 1.0 - std::exp(-e * (Tc - Te)) - e * Ta;
    };
    const auto dfb = [=](double e) {
        return (Tc - Te) * std::exp(-e * (Tc - Te)) - Ta;
    };
    const double e = fzero(fb, dfb, 1.0 / (Ta + 1e-13));

    // a is expressed by another implicit equation
    // integral{0, T0} ULF(t) dt, where ULF(t) is the LF model equation
    const double A = (1.0 - std::exp(-e * (Tc - Te))) / (e * e * Ta) - (Tc - Te) * std::exp(-e * (Tc - Te)) / (e * Ta);
    const auto fa = [=](double a) {
        return (a * a + wg * wg) * std::sin(wg * Te) * A + wg * std::exp(-a * Te) + a * std::sin(wg * Te) - wg * std::cos(wg * Te);
    };
    const auto dfa = [=](double a) {
        return (2 * A * a + 1) * std::sin(wg * Te) - wg * Te * std::exp(-a * Te);
    };
    const double a = fzero(fa, dfa, 4.42);

    m_epsilon = e;
    m_alpha = a;
}