package monitoring

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

// NewLogger returns a configured Zap logger.
func NewLogger() *zap.Logger {
	logger, _ := zap.NewProduction()
	return logger
}

// NewRegistry sets up Prometheus metrics registry and registers core metrics.
func NewRegistry() *prometheus.CounterVec {
	// Define a CounterVec for request counts by endpoint
	counter := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "jaj_requests_total",
			Help: "Total number of requests handled by endpoint",
		},
		[]string{"endpoint"},
	)
	prometheus.MustRegister(counter)

	return counter
}

// MakeMetricsHandler returns an HTTP handler for Prometheus scraping.
func MakeMetricsHandler(counter *prometheus.CounterVec) http.Handler {
	// You can also register other metrics here
	return promhttp.Handler()
}
