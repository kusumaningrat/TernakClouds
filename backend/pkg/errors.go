package pkg

import "github.com/gin-gonic/gin"

func RespondErr(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"error": msg})
}
