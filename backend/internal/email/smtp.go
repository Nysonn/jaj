package email

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
)

// Client holds SMTP server details.
type Client struct {
	Host     string // e.g. "smtp.example.com:587"
	Username string
	Password string
}

// NewClient constructs a new SMTP client.
func NewClient(host, user, pass string) *Client {
	return &Client{Host: host, Username: user, Password: pass}
}

// SendMail sends a plain-text email to the specified recipient.
func (c *Client) SendMail(toEmail, subject, body string) error {
	// Build email headers + body
	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s",
		c.Username, toEmail, subject, body,
	)

	// Split host and port for TLS config
	host, _, err := net.SplitHostPort(c.Host)
	if err != nil {
		return fmt.Errorf("invalid SMTP host:port: %w", err)
	}

	// Establish TLS connection
	tlsConfig := &tls.Config{ServerName: host}
	conn, err := tls.Dial("tcp", c.Host, tlsConfig)
	if err != nil {
		return fmt.Errorf("tls.Dial: %w", err)
	}
	defer conn.Close()

	// Create new SMTP client over that connection
	smtpClient, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp.NewClient: %w", err)
	}
	defer smtpClient.Close()

	// Authenticate
	auth := smtp.PlainAuth("", c.Username, c.Password, host)
	if err := smtpClient.Auth(auth); err != nil {
		return fmt.Errorf("smtp.Auth: %w", err)
	}

	// Set the sender and recipient
	if err := smtpClient.Mail(c.Username); err != nil {
		return fmt.Errorf("Mail from error: %w", err)
	}
	if err := smtpClient.Rcpt(toEmail); err != nil {
		return fmt.Errorf("Rcpt to error: %w", err)
	}

	// Write the message body
	wc, err := smtpClient.Data()
	if err != nil {
		return fmt.Errorf("Data error: %w", err)
	}
	defer wc.Close()

	if _, err := wc.Write([]byte(msg)); err != nil {
		return fmt.Errorf("Write error: %w", err)
	}

	// Close & send
	if err := smtpClient.Quit(); err != nil {
		return fmt.Errorf("Quit error: %w", err)
	}
	return nil
}
