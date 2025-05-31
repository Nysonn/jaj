package email

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
)

// Client holds SMTP server details.
type Client struct {
	Host     string // e.g. "smtp.gmail.com:465"
	Username string
	Password string
}

func NewClient(host, user, pass string) *Client {
	return &Client{Host: host, Username: user, Password: pass}
}

// SendMail sends a plain-text email using implicit TLS (port 465).
func (c *Client) SendMail(toEmail, subject, body string) error {
	// Build raw message
	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s",
		c.Username, toEmail, subject, body,
	)

	// Extract host for TLS config (host: "smtp.gmail.com", port: "465")
	host, _, err := net.SplitHostPort(c.Host)
	if err != nil {
		return fmt.Errorf("invalid SMTP host:port: %w", err)
	}

	// 1. Implicit TLS dial (port 465)
	tlsConfig := &tls.Config{ServerName: host}
	conn, err := tls.Dial("tcp", c.Host, tlsConfig)
	if err != nil {
		return fmt.Errorf("tls.Dial: %w", err)
	}
	defer conn.Close()

	// 2. Create new SMTP client over that TLS connection
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp.NewClient: %w", err)
	}
	defer client.Close()

	// 3. Authenticate
	auth := smtp.PlainAuth("", c.Username, c.Password, host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp.Auth: %w", err)
	}

	// 4. MAIL FROM
	if err := client.Mail(c.Username); err != nil {
		return fmt.Errorf("mail from error: %w", err)
	}

	// 5. RCPT TO
	if err := client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("rcpt to error: %w", err)
	}

	// 6. DATA
	wc, err := client.Data()
	if err != nil {
		return fmt.Errorf("data error: %w", err)
	}
	defer wc.Close()

	if _, err := wc.Write([]byte(msg)); err != nil {
		return fmt.Errorf("write error: %w", err)
	}

	// 7. QUIT
	err = client.Quit()
	if err != nil {
		// Gmail (and some servers) send "250 2.0.0 OK" on QUIT instead of 221.
		// We treat any 250 starting with "250 " as not-an-error.
		if strings.HasPrefix(err.Error(), "250 ") {
			// Ignore the 250 OK on QUIT
			return nil
		}
		return fmt.Errorf("quit error: %w", err)
	}
	return nil
}
