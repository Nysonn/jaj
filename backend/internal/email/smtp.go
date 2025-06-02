package email

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"net/textproto"
	"strings"
	"text/template"
	"time"
)

// Data structures for email templates
type VerifyEmailData struct {
	Username  string
	VerifyURL string
}

type ResetPasswordData struct {
	Username string
	ResetURL string
}

// New struct for order confirmation data:
type OrderConfirmationData struct {
	Username string
	OrderID  int
	Items    []struct {
		Name      string
		Quantity  int
		UnitPrice int
		Subtotal  int
	}
	TransportFee  int
	TotalCost     int
	PickupTime    string
	PickupStation string
}

// New struct for cancellation:
type OrderCancellationData struct {
	Username string
	OrderID  int
}

// Load templates from files
var (
	textTmpl             *template.Template
	htmlTmpl             *template.Template
	resetTextTmpl        *template.Template
	resetHTMLTmpl        *template.Template
	orderConfirmHTMLTmpl *template.Template
	orderConfirmTextTmpl *template.Template
	orderCancelHTMLTmpl  *template.Template
	orderCancelTextTmpl  *template.Template
)

func init() {
	var err error

	// Load verification email templates
	textTmpl, err = template.ParseFiles("templates/verify_email.txt")
	if err != nil {
		panic("Failed to load verify_email.txt template: " + err.Error())
	}

	htmlTmpl, err = template.ParseFiles("templates/verify_email.html")
	if err != nil {
		panic("Failed to load verify_email.html template: " + err.Error())
	}

	// Load password reset templates
	resetTextTmpl, err = template.ParseFiles("templates/reset_password.txt")
	if err != nil {
		panic("Failed to load reset_password.txt template: " + err.Error())
	}

	resetHTMLTmpl, err = template.ParseFiles("templates/reset_password.html")
	if err != nil {
		panic("Failed to load reset_password.html template: " + err.Error())
	}

	orderConfirmTextTmpl, err = template.ParseFiles("templates/order_confirmation.txt")
	if err != nil {
		panic("Failed to load order confirmation txt template: " + err.Error())
	}

	orderConfirmHTMLTmpl, err = template.ParseFiles("templates/order_confirmation.html")
	if err != nil {
		panic("Failed to load order confirmation html template: " + err.Error())
	}

	orderCancelTextTmpl, err = template.ParseFiles("templates/order_cancellation.txt")
	if err != nil {
		panic("Failed to load order cancellation txt template: " + err.Error())
	}

	orderCancelHTMLTmpl, err = template.ParseFiles("templates/order_cancellation.html")
	if err != nil {
		panic("Failed to load order cancellation html template: " + err.Error())
	}
}

// Client holds SMTP server details.
type Client struct {
	Host     string // e.g. "smtp.gmail.com:465"
	Username string
	Password string
}

func NewClient(host, user, pass string) *Client {
	return &Client{Host: host, Username: user, Password: pass}
}

// SendVerificationEmail renders the templates and sends a multipart email.
func (c *Client) SendVerificationEmail(toEmail, username, token string) error {
	// 1. Build the verify link
	baseURL := "http://localhost:8080" // your actual domain or read from env
	verifyLink := fmt.Sprintf("%s/verify?token=%s", baseURL, token)

	data := VerifyEmailData{
		Username:  username,
		VerifyURL: verifyLink,
	}

	// 2. Render the text and HTML bodies
	var textBuf bytes.Buffer
	if err := textTmpl.Execute(&textBuf, data); err != nil {
		return fmt.Errorf("render text template: %w", err)
	}
	var htmlBuf bytes.Buffer
	if err := htmlTmpl.Execute(&htmlBuf, data); err != nil {
		return fmt.Errorf("render html template: %w", err)
	}

	// 3. Build the multipart/alternative MIME envelope
	boundary := fmt.Sprintf("===%d===", time.Now().UnixNano())
	var msg bytes.Buffer

	// Basic headers
	msg.WriteString(fmt.Sprintf("From: %s\r\n", c.Username))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", toEmail))
	msg.WriteString("Subject: Verify Your JAJ Email\r\n")
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=\"%s\"\r\n", boundary))
	msg.WriteString("\r\n") // end of headers

	// -- Start plain‐text part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/plain; charset=\"UTF-8\"\r\n")
	msg.WriteString("Content-Transfer-Encoding: 7bit\r\n")
	msg.WriteString("\r\n")
	msg.Write(textBuf.Bytes())
	msg.WriteString("\r\n")

	// -- Start HTML part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	msg.WriteString("Content-Transfer-Encoding: 7bit\r\n")
	msg.WriteString("\r\n")
	msg.Write(htmlBuf.Bytes())
	msg.WriteString("\r\n")

	// -- Closing boundary
	msg.WriteString(fmt.Sprintf("--%s--\r\n", boundary))

	// 4. Send via SMTP (implicit TLS on port 465). Reuse your existing logic:
	host, _, err := net.SplitHostPort(c.Host)
	if err != nil {
		return fmt.Errorf("invalid SMTP host:port: %w", err)
	}

	tlsConfig := &tls.Config{ServerName: host}
	conn, err := tls.Dial("tcp", c.Host, tlsConfig)
	if err != nil {
		return fmt.Errorf("tls.Dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp.NewClient: %w", err)
	}
	defer client.Close()

	auth := smtp.PlainAuth("", c.Username, c.Password, host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp.Auth: %w", err)
	}

	if err := client.Mail(c.Username); err != nil {
		return fmt.Errorf("mail from error: %w", err)
	}
	if err := client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("rcpt to error: %w", err)
	}

	wc, err := client.Data()
	if err != nil {
		return fmt.Errorf("data error: %w", err)
	}
	if _, err := wc.Write(msg.Bytes()); err != nil {
		wc.Close()
		return fmt.Errorf("write error: %w", err)
	}
	wc.Close()

	// Tolerate Gmail's 250 on QUIT
	if err := client.Quit(); err != nil {
		if textErr, ok := err.(*textproto.Error); ok && strings.HasPrefix(textErr.Error(), "250 ") {
			return nil
		}
		return fmt.Errorf("quit error: %w", err)
	}

	return nil
}

// SendResetPasswordEmail sends a multipart HTML+text reset email.
func (c *Client) SendResetPasswordEmail(toEmail, username, token string) error {
	// 1. Build the reset link (use your front-end domain)
	baseURL := "http://localhost:8080"
	resetLink := fmt.Sprintf("%s/password-reset?token=%s", baseURL, token)

	data := ResetPasswordData{
		Username: username,
		ResetURL: resetLink,
	}

	// 2. Render the plain‐text and HTML bodies
	var textBuf bytes.Buffer
	if err := resetTextTmpl.Execute(&textBuf, data); err != nil {
		return fmt.Errorf("render reset text template: %w", err)
	}
	var htmlBuf bytes.Buffer
	if err := resetHTMLTmpl.Execute(&htmlBuf, data); err != nil {
		return fmt.Errorf("render reset html template: %w", err)
	}

	// 3. Build MIME multipart/alternative message
	boundary := fmt.Sprintf("===%d===", time.Now().UnixNano())
	var msg bytes.Buffer

	msg.WriteString(fmt.Sprintf("From: %s\r\n", c.Username))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", toEmail))
	msg.WriteString("Subject: Reset Your JAJ Password\r\n")
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=\"%s\"\r\n", boundary))
	msg.WriteString("\r\n")

	// Plain‐text part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/plain; charset=\"UTF-8\"\r\n")
	msg.WriteString("Content-Transfer-Encoding: 7bit\r\n")
	msg.WriteString("\r\n")
	msg.Write(textBuf.Bytes())
	msg.WriteString("\r\n")

	// HTML part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	msg.WriteString("Content-Transfer-Encoding: 7bit\r\n")
	msg.WriteString("\r\n")
	msg.Write(htmlBuf.Bytes())
	msg.WriteString("\r\n")

	// Closing boundary
	msg.WriteString(fmt.Sprintf("--%s--\r\n", boundary))

	// 4. Send via SMTPS (port 465)
	host, _, err := net.SplitHostPort(c.Host)
	if err != nil {
		return fmt.Errorf("invalid SMTP host:port: %w", err)
	}

	tlsConfig := &tls.Config{ServerName: host}
	conn, err := tls.Dial("tcp", c.Host, tlsConfig)
	if err != nil {
		return fmt.Errorf("tls.Dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp.NewClient: %w", err)
	}
	defer client.Close()

	auth := smtp.PlainAuth("", c.Username, c.Password, host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp.Auth: %w", err)
	}

	if err := client.Mail(c.Username); err != nil {
		return fmt.Errorf("mail from error: %w", err)
	}
	if err := client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("rcpt to error: %w", err)
	}

	wc, err := client.Data()
	if err != nil {
		return fmt.Errorf("data error: %w", err)
	}
	if _, err := wc.Write(msg.Bytes()); err != nil {
		wc.Close()
		return fmt.Errorf("qrite error: %w", err)
	}
	wc.Close()

	if err := client.Quit(); err != nil {
		if smtpErr, ok := err.(*textproto.Error); ok && strings.HasPrefix(smtpErr.Error(), "250 ") {
			return nil
		}
		return fmt.Errorf("quit error: %w", err)
	}

	return nil
}

// SendOrderConfirmationEmail sends a multipart HTML+text confirmation email.
func (c *Client) SendOrderConfirmationEmail(
	toEmail string,
	data OrderConfirmationData,
) error {
	// 1. Render the text body
	var textBuf bytes.Buffer
	if err := orderConfirmTextTmpl.Execute(&textBuf, data); err != nil {
		return fmt.Errorf("render order‐confirm text template: %w", err)
	}
	// 2. Render the HTML body
	var htmlBuf bytes.Buffer
	if err := orderConfirmHTMLTmpl.Execute(&htmlBuf, data); err != nil {
		return fmt.Errorf("render order‐confirm HTML template: %w", err)
	}

	// 3. Build the multipart MIME message
	boundary := fmt.Sprintf("===%d===", time.Now().UnixNano())
	var msg bytes.Buffer

	// Headers
	msg.WriteString(fmt.Sprintf("From: %s\r\n", c.Username))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", toEmail))
	msg.WriteString(fmt.Sprintf("Subject: JAJ Order Confirmation #%d\r\n", data.OrderID))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=\"%s\"\r\n", boundary))
	msg.WriteString("\r\n") // end of headers

	// Plain‐text part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/plain; charset=\"UTF-8\"\r\n")
	msg.WriteString("Content-Transfer-Encoding: 7bit\r\n")
	msg.WriteString("\r\n")
	msg.Write(textBuf.Bytes())
	msg.WriteString("\r\n")

	// HTML part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	msg.WriteString("Content-Transfer-Encoding: 7bit\r\n")
	msg.WriteString("\r\n")
	msg.Write(htmlBuf.Bytes())
	msg.WriteString("\r\n")

	// Closing boundary
	msg.WriteString(fmt.Sprintf("--%s--\r\n", boundary))

	// 4. Send via SMTPS (port 465)
	host, _, err := net.SplitHostPort(c.Host)
	if err != nil {
		return fmt.Errorf("invalid SMTP host:port: %w", err)
	}
	tlsConfig := &tls.Config{ServerName: host}
	conn, err := tls.Dial("tcp", c.Host, tlsConfig)
	if err != nil {
		return fmt.Errorf("tls.Dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp.NewClient: %w", err)
	}
	defer client.Close()

	// Authenticate
	auth := smtp.PlainAuth("", c.Username, c.Password, host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp.Auth: %w", err)
	}

	// MAIL FROM
	if err := client.Mail(c.Username); err != nil {
		return fmt.Errorf("mail from error: %w", err)
	}
	// RCPT TO
	if err := client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("rcpt to error: %w", err)
	}

	// DATA
	wc, err := client.Data()
	if err != nil {
		return fmt.Errorf("data error: %w", err)
	}
	if _, err := wc.Write(msg.Bytes()); err != nil {
		wc.Close()
		return fmt.Errorf("write error: %w", err)
	}
	wc.Close()

	// QUIT (ignore 250 from Gmail on QUIT)
	if err := client.Quit(); err != nil {
		if smtpErr, ok := err.(*textproto.Error); ok && strings.HasPrefix(smtpErr.Error(), "250 ") {
			return nil
		}
		return fmt.Errorf("quit error: %w", err)
	}

	return nil
}

// SendOrderCancellationEmail sends a multipart HTML+text cancellation email.
func (c *Client) SendOrderCancellationEmail(
	toEmail string,
	data OrderCancellationData,
) error {
	// 1. Render plain-text
	var textBuf bytes.Buffer
	if err := orderCancelTextTmpl.Execute(&textBuf, data); err != nil {
		return fmt.Errorf("render cancellation text template: %w", err)
	}
	// 2. Render HTML
	var htmlBuf bytes.Buffer
	if err := orderCancelHTMLTmpl.Execute(&htmlBuf, data); err != nil {
		return fmt.Errorf("render cancellation HTML template: %w", err)
	}

	// 3. Build MIME multipart/alternative message
	boundary := fmt.Sprintf("===%d===", time.Now().UnixNano())
	var msg bytes.Buffer

	// Headers
	msg.WriteString(fmt.Sprintf("From: %s\r\n", c.Username))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", toEmail))
	msg.WriteString(fmt.Sprintf("Subject: JAJ Order #%d Cancelled\r\n", data.OrderID))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=\"%s\"\r\n", boundary))
	msg.WriteString("\r\n") // end headers

	// Plain-text part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/plain; charset=\"UTF-8\"\r\n")
	msg.WriteString("Content-Transfer-Encoding: 7bit\r\n")
	msg.WriteString("\r\n")
	msg.Write(textBuf.Bytes())
	msg.WriteString("\r\n")

	// HTML part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	msg.WriteString("Content-Transfer-Encoding: 7bit\r\n")
	msg.WriteString("\r\n")
	msg.Write(htmlBuf.Bytes())
	msg.WriteString("\r\n")

	// Closing boundary
	msg.WriteString(fmt.Sprintf("--%s--\r\n", boundary))

	// 4. Send via SMTPS (port 465)
	host, _, err := net.SplitHostPort(c.Host)
	if err != nil {
		return fmt.Errorf("invalid SMTP host:port: %w", err)
	}
	tlsConfig := &tls.Config{ServerName: host}
	conn, err := tls.Dial("tcp", c.Host, tlsConfig)
	if err != nil {
		return fmt.Errorf("tls.Dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp.NewClient: %w", err)
	}
	defer client.Close()

	auth := smtp.PlainAuth("", c.Username, c.Password, host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp.Auth: %w", err)
	}

	if err := client.Mail(c.Username); err != nil {
		return fmt.Errorf("mail from error: %w", err)
	}
	if err := client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("rcpt to error: %w", err)
	}

	wc, err := client.Data()
	if err != nil {
		return fmt.Errorf("data error: %w", err)
	}
	if _, err := wc.Write(msg.Bytes()); err != nil {
		wc.Close()
		return fmt.Errorf("write error: %w", err)
	}
	wc.Close()

	// QUIT (ignore Gmail’s 250 OK on QUIT)
	if err := client.Quit(); err != nil {
		if smtpErr, ok := err.(*textproto.Error); ok && strings.HasPrefix(smtpErr.Error(), "250 ") {
			return nil
		}
		return fmt.Errorf("quit error: %w", err)
	}
	return nil
}
